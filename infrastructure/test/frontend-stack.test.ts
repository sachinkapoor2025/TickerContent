import assert from "node:assert/strict";
import { test } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { TickerCmsFrontendStack } from "../lib/frontend-stack";

const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
const ALL_VIEWER_EXCEPT_HOST = "b689b0a8-53d0-40ab-baf2-68738e2966ac";

type Origin = {
  Id: string;
  DomainName: unknown;
  S3OriginConfig?: unknown;
  CustomOriginConfig?: {
    HTTPPort: number;
    OriginProtocolPolicy: string;
    OriginReadTimeout?: number;
  };
};

type CacheBehavior = {
  PathPattern: string;
  TargetOriginId: string;
  CachePolicyId?: string;
  OriginRequestPolicyId?: string;
  AllowedMethods?: string[];
  FunctionAssociations?: unknown[];
};

type DistConfig = {
  DefaultCacheBehavior: {
    TargetOriginId: string;
    CachePolicyId?: string;
    FunctionAssociations?: Array<{ EventType: string }>;
  };
  CacheBehaviors: CacheBehavior[];
  Origins: Origin[];
  CustomErrorResponses?: unknown[];
};

function frontendDistributions(): DistConfig[] {
  const app = new cdk.App();
  const apiStack = new cdk.Stack(app, "ApiStub");
  const vpc = new ec2.Vpc(apiStack, "Vpc", { maxAzs: 2, natGateways: 0 });
  const alb = new elbv2.ApplicationLoadBalancer(apiStack, "Alb", { vpc, internetFacing: true });
  const stack = new TickerCmsFrontendStack(app, "Frontend", {
    apiLoadBalancer: alb,
    skipAssetDeployment: true,
  });
  const template = Template.fromStack(stack);
  const dists = template.findResources("AWS::CloudFront::Distribution");
  return Object.values(dists).map((resource) => resource.Properties.DistributionConfig as DistConfig);
}

function originById(config: DistConfig, originId: string): Origin {
  const origin = config.Origins.find((item) => item.Id === originId);
  assert.ok(origin, `origin ${originId} exists`);
  return origin;
}

function behavior(config: DistConfig, path: string): CacheBehavior {
  const found = config.CacheBehaviors.find((item) => item.PathPattern === path);
  assert.ok(found, `behavior ${path} exists`);
  return found;
}

test("Customer and Admin CloudFront both route /v1/* and /health to the same ALB", () => {
  const dists = frontendDistributions();
  assert.equal(dists.length, 2);

  const albDomainNames = new Set<string>();

  for (const config of dists) {
    const v1 = behavior(config, "/v1/*");
    const health = behavior(config, "/health");
    const v1Origin = originById(config, v1.TargetOriginId);
    const healthOrigin = originById(config, health.TargetOriginId);
    const defaultOrigin = originById(config, config.DefaultCacheBehavior.TargetOriginId);

    assert.ok(defaultOrigin.S3OriginConfig, "default behavior stays on the private S3 origin");
    assert.ok(!defaultOrigin.CustomOriginConfig, "default behavior is not the API ALB");
    assert.equal(v1Origin.CustomOriginConfig?.HTTPPort, 80);
    assert.equal(v1Origin.CustomOriginConfig?.OriginProtocolPolicy, "http-only");
    assert.equal(v1Origin.CustomOriginConfig?.OriginReadTimeout, 30);
    assert.deepEqual(v1Origin.DomainName, healthOrigin.DomainName);
    albDomainNames.add(JSON.stringify(v1Origin.DomainName));

    assert.equal(v1.CachePolicyId, CACHING_DISABLED);
    assert.equal(health.CachePolicyId, CACHING_DISABLED);
    assert.equal(v1.OriginRequestPolicyId, ALL_VIEWER_EXCEPT_HOST);
    assert.equal(health.OriginRequestPolicyId, ALL_VIEWER_EXCEPT_HOST);
    for (const method of ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]) {
      assert.ok(v1.AllowedMethods?.includes(method), `/v1/* allows ${method}`);
      assert.ok(health.AllowedMethods?.includes(method), `/health allows ${method}`);
    }
    assert.ok(!v1.FunctionAssociations || v1.FunctionAssociations.length === 0);
    assert.ok(!health.FunctionAssociations || health.FunctionAssociations.length === 0);
    assert.ok(
      config.DefaultCacheBehavior.FunctionAssociations?.some((item) => item.EventType === "viewer-request"),
      "SPA fallback is limited to the S3 default behavior",
    );
    assert.ok(!config.CustomErrorResponses || config.CustomErrorResponses.length === 0);
    assert.notEqual(config.DefaultCacheBehavior.CachePolicyId, CACHING_DISABLED);
  }

  assert.equal(albDomainNames.size, 1, "Customer and Admin API origins must be the same ALB");
});

test("Customer CloudFront rewrites /player to player index.html and does not treat it as the tenant SPA", () => {
  const app = new cdk.App();
  const apiStack = new cdk.Stack(app, "ApiStub");
  const vpc = new ec2.Vpc(apiStack, "Vpc", { maxAzs: 2, natGateways: 0 });
  const alb = new elbv2.ApplicationLoadBalancer(apiStack, "Alb", { vpc, internetFacing: true });
  const stack = new TickerCmsFrontendStack(app, "Frontend", {
    apiLoadBalancer: alb,
    skipAssetDeployment: true,
  });
  const template = Template.fromStack(stack);
  const functions = template.findResources("AWS::CloudFront::Function");
  const codes = Object.values(functions).map((resource) => String(resource.Properties.FunctionCode ?? ""));
  const customer = codes.find((code) => code.includes("request.uri = '/player/index.html'"));
  const admin = codes.find(
    (code) => code.includes("request.uri = '/index.html'") && !code.includes("/player/index.html"),
  );
  assert.ok(customer, "Customer viewer-request function rewrites /player to /player/index.html");
  assert.ok(customer.includes("uri === '/player'") || customer.includes('uri === "/player"'));
  assert.ok(customer.includes("/player/"));
  assert.ok(admin, "Admin viewer-request function still rewrites only to /index.html");
  template.resourceCountIs("AWS::CloudFront::Function", 2);
});

test("frontend stack still uses private S3 buckets and a single ALB origin pair", () => {
  const app = new cdk.App();
  const apiStack = new cdk.Stack(app, "ApiStub");
  const vpc = new ec2.Vpc(apiStack, "Vpc", { maxAzs: 2, natGateways: 0 });
  const alb = new elbv2.ApplicationLoadBalancer(apiStack, "Alb", { vpc, internetFacing: true });
  const stack = new TickerCmsFrontendStack(app, "Frontend", {
    apiLoadBalancer: alb,
    skipAssetDeployment: true,
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::CloudFront::Distribution", 2);
  template.resourceCountIs("AWS::ElasticLoadBalancingV2::LoadBalancer", 0);
  template.resourceCountIs("AWS::ApiGateway::RestApi", 0);
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: Match.objectLike({
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    }),
  });
});
