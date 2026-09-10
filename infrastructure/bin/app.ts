#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TickerCmsApiStack } from "../lib/api-stack";
import { TickerCmsFrontendStack } from "../lib/frontend-stack";

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1",
};

const webOrigin =
  (app.node.tryGetContext("webOrigin") as string | undefined) ?? process.env.TICKER_WEB_ORIGIN;

const api = new TickerCmsApiStack(app, "TickerCmsApi", { env, webOrigin });
new TickerCmsFrontendStack(app, "TickerCmsFrontend", {
  env,
  apiLoadBalancer: api.alb,
});

