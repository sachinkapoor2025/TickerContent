import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export class TickerCmsFrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const adminBucket = new s3.Bucket(this, "AdminBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const webDist = new cloudfront.Distribution(this, "WebCdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });
    const adminDist = new cloudfront.Distribution(this, "AdminCdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    const webDir = path.join(__dirname, "../../apps/web/dist");
    const adminDir = path.join(__dirname, "../../apps/admin/dist");

    new s3deploy.BucketDeployment(this, "DeployWeb", {
      destinationBucket: webBucket,
      distribution: webDist,
      sources: [s3deploy.Source.asset(webDir)],
    });
    new s3deploy.BucketDeployment(this, "DeployAdmin", {
      destinationBucket: adminBucket,
      distribution: adminDist,
      sources: [s3deploy.Source.asset(adminDir)],
    });

    new cdk.CfnOutput(this, "WebUrl", { value: `https://${webDist.distributionDomainName}` });
    new cdk.CfnOutput(this, "AdminUrl", { value: `https://${adminDist.distributionDomainName}` });
  }
}
