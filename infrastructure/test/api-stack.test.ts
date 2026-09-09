import assert from "node:assert/strict";
import { test } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as ecs from "aws-cdk-lib/aws-ecs";
import {
  API_ASSETS_DIR,
  API_CONTAINER_PORT,
  API_DATA_MOUNT,
  API_DB_PATH,
  TickerCmsApiStack,
} from "../lib/api-stack";

function synthTemplate(): Template {
  const app = new cdk.App();
  const stack = new TickerCmsApiStack(app, "TestApi", {
    apiImage: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/node:20-bookworm-slim"),
  });
  return Template.fromStack(stack);
}

test("presentation API uses one Fargate task behind an ALB", () => {
  const template = synthTemplate();

  template.hasResourceProperties("AWS::ECS::Service", {
    DesiredCount: 1,
    LaunchType: "FARGATE",
  });
  template.resourceCountIs("AWS::ElasticLoadBalancingV2::LoadBalancer", 1);
  template.resourceCountIs("AWS::ElasticLoadBalancingV2::TargetGroup", 1);
  template.hasResourceProperties("AWS::ElasticLoadBalancingV2::TargetGroup", {
    HealthCheckPath: "/health",
    HealthCheckProtocol: "HTTP",
    Matcher: { HttpCode: "200" },
    TargetType: "ip",
    Port: API_CONTAINER_PORT,
  });
});

test("API container listens on PORT and separates SQLite from assets on EFS", () => {
  const template = synthTemplate();

  template.hasResourceProperties("AWS::ECS::TaskDefinition", {
    Cpu: "512",
    Memory: "1024",
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({
        Command: ["npm", "run", "start", "-w", "@ticker-cms/api"],
        PortMappings: Match.arrayWith([
          Match.objectLike({ ContainerPort: API_CONTAINER_PORT }),
        ]),
        Environment: Match.arrayWith([
          { Name: "PORT", Value: String(API_CONTAINER_PORT) },
          { Name: "TICKER_DATA_DIR", Value: API_DATA_MOUNT },
          { Name: "TICKER_DB_PATH", Value: API_DB_PATH },
          { Name: "ASSET_STORAGE", Value: "s3" },
          Match.objectLike({ Name: "ASSET_BUCKET" }),
        ]),
        MountPoints: Match.arrayWith([
          Match.objectLike({
            ContainerPath: API_DATA_MOUNT,
            ReadOnly: false,
          }),
        ]),
      }),
    ]),
    Volumes: Match.arrayWith([
      Match.objectLike({
        Name: "ticker-data",
        EFSVolumeConfiguration: Match.objectLike({
          TransitEncryption: "ENABLED",
          AuthorizationConfig: Match.objectLike({ IAM: "ENABLED" }),
        }),
      }),
    ]),
  });

  template.resourceCountIs("AWS::EFS::FileSystem", 1);
  template.hasResourceProperties("AWS::EFS::FileSystem", {
    Encrypted: true,
  });
  assert.equal(API_ASSETS_DIR, `${API_DATA_MOUNT}/assets`);
  assert.notEqual(API_DB_PATH, API_ASSETS_DIR);
});

test("does not add Lambda, API Gateway, RDS, or Cognito", () => {
  const template = synthTemplate();
  template.resourceCountIs("AWS::Lambda::Function", 0);
  template.resourceCountIs("AWS::ApiGateway::RestApi", 0);
  template.resourceCountIs("AWS::ApiGatewayV2::Api", 0);
  template.resourceCountIs("AWS::RDS::DBInstance", 0);
  template.resourceCountIs("AWS::RDS::DBCluster", 0);
  template.resourceCountIs("AWS::Cognito::UserPool", 0);
  template.resourceCountIs("AWS::IoT::Thing", 0);
  template.resourceCountIs("AWS::SQS::Queue", 0);
  template.resourceCountIs("AWS::Events::Rule", 0);
});

test("WEB_ORIGIN can be passed as the Customer CloudFront URL", () => {
  const app = new cdk.App();
  const stack = new TickerCmsApiStack(app, "TestApi", {
    apiImage: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/node:20-bookworm-slim"),
    webOrigin: "https://d111111abcdef8.cloudfront.net",
  });
  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::ECS::TaskDefinition", {
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({
        Environment: Match.arrayWith([{ Name: "WEB_ORIGIN", Value: "https://d111111abcdef8.cloudfront.net" }]),
      }),
    ]),
  });
});

type IngressRule = { CidrIp?: string; FromPort?: number; SourceSecurityGroupId?: unknown };

function collectIngress(template: Template): IngressRule[] {
  const fromGroups = Object.values(template.findResources("AWS::EC2::SecurityGroup")).flatMap((resource) => {
    const props = resource.Properties as { SecurityGroupIngress?: IngressRule[] };
    return props.SecurityGroupIngress ?? [];
  });
  const standalone = Object.values(template.findResources("AWS::EC2::SecurityGroupIngress")).map((resource) => {
    return resource.Properties as IngressRule;
  });
  return [...fromGroups, ...standalone];
}

test("ALB is internet HTTP; API tasks only accept ALB traffic", () => {
  const template = synthTemplate();
  const ingress = collectIngress(template);

  assert.ok(
    ingress.some((rule) => rule.FromPort === 80 && rule.CidrIp === "0.0.0.0/0"),
    "ALB should accept HTTP from the internet",
  );
  assert.ok(
    ingress.some((rule) => rule.FromPort === API_CONTAINER_PORT && rule.SourceSecurityGroupId != null),
    "API tasks should accept the container port only from a security group",
  );
  assert.ok(
    !ingress.some((rule) => rule.FromPort === API_CONTAINER_PORT && rule.CidrIp === "0.0.0.0/0"),
    "API container port must not be open to the internet",
  );
});

test("presentation asset bucket is private and the task role can only read/write/delete objects", () => {
  const template = synthTemplate();
  template.resourceCountIs("AWS::S3::Bucket", 1);
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
    BucketEncryption: {
      ServerSideEncryptionConfiguration: Match.arrayWith([
        Match.objectLike({
          ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
        }),
      ]),
    },
  });

  const buckets = template.findResources("AWS::S3::Bucket");
  for (const bucket of Object.values(buckets)) {
    const props = bucket.Properties as { WebsiteConfiguration?: unknown; AccessControl?: string };
    assert.equal(props.WebsiteConfiguration, undefined);
    assert.notEqual(props.AccessControl, "PublicRead");
  }

  const policies = template.findResources("AWS::IAM::Policy");
  const statements = Object.values(policies).flatMap((policy) => {
    const doc = policy.Properties.PolicyDocument as {
      Statement?: Array<{ Action?: string | string[]; Resource?: unknown; Effect?: string }>;
    };
    return doc.Statement ?? [];
  });
  const assetStatement = statements.find((statement) => {
    const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    return actions.includes("s3:GetObject") && actions.includes("s3:PutObject") && actions.includes("s3:DeleteObject");
  });
  assert.ok(assetStatement, "task role should allow GetObject, PutObject, and DeleteObject");
  const actions = Array.isArray(assetStatement?.Action) ? assetStatement.Action : [assetStatement?.Action];
  assert.ok(!actions.includes("s3:*"));
  assert.ok(!actions.includes("s3:ListBucket"));
  const resource = JSON.stringify(assetStatement?.Resource ?? "");
  assert.ok(resource.includes("/*"), "object permissions should be scoped to bucket objects");
});
