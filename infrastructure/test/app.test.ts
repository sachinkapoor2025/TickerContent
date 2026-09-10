import assert from "node:assert/strict";
import { test } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { TickerCmsApiStack } from "../lib/api-stack";
import { TickerCmsFrontendStack } from "../lib/frontend-stack";

const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";

function presentationApp() {
  const app = new cdk.App();
  const api = new TickerCmsApiStack(app, "TickerCmsApi", {
    apiImage: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/node:20-bookworm-slim"),
    webOrigin: "https://d111111abcdef8.cloudfront.net",
  });
  const frontend = new TickerCmsFrontendStack(app, "TickerCmsFrontend", {
    apiLoadBalancer: api.alb,
    skipAssetDeployment: true,
  });
  return { app, api, frontend };
}

test("CDK app includes API and frontend stacks and deploys API first", () => {
  const { app, api, frontend } = presentationApp();
  const assembly = app.synth();
  const names = assembly.stacks.map((stack) => stack.stackName);
  assert.ok(names.includes("TickerCmsApi"));
  assert.ok(names.includes("TickerCmsFrontend"));

  const frontendTemplate = Template.fromStack(frontend);
  const frontendJson = JSON.stringify(frontendTemplate.toJSON());
  assert.ok(frontendJson.includes("TickerCmsApi"), "Customer/Admin CloudFront must reference the API stack ALB");

  const apiTemplate = Template.fromStack(api);
  apiTemplate.resourceCountIs("AWS::ECS::Service", 1);
  apiTemplate.hasResourceProperties("AWS::ECS::Service", { DesiredCount: 1, LaunchType: "FARGATE" });
  apiTemplate.resourceCountIs("AWS::ElasticLoadBalancingV2::LoadBalancer", 1);
  apiTemplate.resourceCountIs("AWS::EFS::FileSystem", 1);
  apiTemplate.resourceCountIs("AWS::S3::Bucket", 1);
  apiTemplate.resourceCountIs("AWS::Lambda::Function", 0);
  apiTemplate.resourceCountIs("AWS::ApiGateway::RestApi", 0);
  apiTemplate.resourceCountIs("AWS::RDS::DBCluster", 0);

  frontendTemplate.resourceCountIs("AWS::CloudFront::Distribution", 2);
  const dists = frontendTemplate.findResources("AWS::CloudFront::Distribution");
  for (const dist of Object.values(dists)) {
    const behaviors = (dist.Properties.DistributionConfig as { CacheBehaviors: Array<{ PathPattern: string; CachePolicyId: string }> })
      .CacheBehaviors;
    assert.ok(behaviors.some((behavior) => behavior.PathPattern === "/v1/*" && behavior.CachePolicyId === CACHING_DISABLED));
    assert.ok(behaviors.some((behavior) => behavior.PathPattern === "/health" && behavior.CachePolicyId === CACHING_DISABLED));
  }
});

test("production container env is represented and secrets are not hardcoded", () => {
  const { api } = presentationApp();
  const template = Template.fromStack(api);
  const json = JSON.stringify(template.toJSON());

  template.hasResourceProperties("AWS::ECS::TaskDefinition", {
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({
        Environment: Match.arrayWith([
          { Name: "NODE_ENV", Value: "production" },
          { Name: "PORT", Value: "8080" },
          { Name: "WEB_ORIGIN", Value: "https://d111111abcdef8.cloudfront.net" },
          { Name: "TICKER_DATA_DIR", Value: "/mnt/ticker-data" },
          { Name: "TICKER_DB_PATH", Value: "/mnt/ticker-data/db/ticker-cms.sqlite" },
          { Name: "ASSET_STORAGE", Value: "s3" },
          Match.objectLike({ Name: "ASSET_BUCKET" }),
        ]),
        Secrets: Match.arrayWith([Match.objectLike({ Name: "JWT_SECRET" })]),
      }),
    ]),
  });

  assert.equal(json.includes("dev-only-change-me"), false);
  assert.equal(json.includes("AWS_ACCESS_KEY_ID"), false);
  assert.equal(json.includes("AWS_SECRET_ACCESS_KEY"), false);
  assert.equal(json.includes("Demo@12345"), false);

  const buckets = template.findResources("AWS::S3::Bucket");
  for (const bucket of Object.values(buckets)) {
    const props = bucket.Properties as {
      PublicAccessBlockConfiguration?: { RestrictPublicBuckets?: boolean };
      AccessControl?: string;
    };
    assert.equal(props.PublicAccessBlockConfiguration?.RestrictPublicBuckets, true);
    assert.notEqual(props.AccessControl, "PublicRead");
  }
});
