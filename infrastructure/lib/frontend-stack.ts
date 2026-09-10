import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface TickerCmsFrontendStackProps extends cdk.StackProps {
  /** Presentation API ALB from TickerCmsApi. One ALB shared by Customer and Admin. */
  apiLoadBalancer: elbv2.IApplicationLoadBalancer;
  /** Test-only: skip BucketDeployment so unit tests do not require SPA dist folders. */
  skipAssetDeployment?: boolean;
}

export class TickerCmsFrontendStack extends cdk.Stack {
  public readonly webDistribution: cloudfront.Distribution;
  public readonly adminDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: TickerCmsFrontendStackProps) {
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

    const apiOriginProps: origins.LoadBalancerV2OriginProps = {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 80,
      readTimeout: cdk.Duration.seconds(30),
      keepaliveTimeout: cdk.Duration.seconds(5),
      connectionTimeout: cdk.Duration.seconds(10),
    };
    const webApiOrigin = new origins.LoadBalancerV2Origin(props.apiLoadBalancer, apiOriginProps);
    const adminApiOrigin = new origins.LoadBalancerV2Origin(props.apiLoadBalancer, apiOriginProps);

    // Distribution-level 403/404 → /index.html would also rewrite API errors.
    // SPA deep links stay on the S3 default behavior via this viewer-request rewrite.
    // Customer must not rewrite /player/ to the tenant SPA; hashed Player assets keep their extension.
    const customerSpaFallbackFn = new cloudfront.Function(this, "CustomerSpaFallbackFn", {
      comment: "Rewrite /player to player index.html; other extensionless Customer routes to /index.html",
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('.') !== -1) {
    return request;
  }
  if (uri === '/player' || uri.indexOf('/player/') === 0) {
    request.uri = '/player/index.html';
    return request;
  }
  request.uri = '/index.html';
  return request;
}
`),
    });
    const spaFallbackFn = new cloudfront.Function(this, "SpaFallbackFn", {
      comment: "Rewrite extensionless Admin routes to /index.html; API behaviors do not use this function",
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('.') !== -1) {
    return request;
  }
  request.uri = '/index.html';
  return request;
}
`),
    });

    const customerSpaFunctionAssociation: cloudfront.FunctionAssociation = {
      function: customerSpaFallbackFn,
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
    };
    const spaFunctionAssociation: cloudfront.FunctionAssociation = {
      function: spaFallbackFn,
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
    };

    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: webApiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      compress: true,
    };

    this.webDistribution = new cloudfront.Distribution(this, "WebCdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [customerSpaFunctionAssociation],
      },
      additionalBehaviors: {
        "/v1/*": apiBehavior,
        "/health": { ...apiBehavior, origin: webApiOrigin },
      },
    });
    this.adminDistribution = new cloudfront.Distribution(this, "AdminCdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [spaFunctionAssociation],
      },
      additionalBehaviors: {
        "/v1/*": { ...apiBehavior, origin: adminApiOrigin },
        "/health": { ...apiBehavior, origin: adminApiOrigin },
      },
    });

    if (!props.skipAssetDeployment) {
      const webDir = path.join(__dirname, "../../apps/web/dist");
      const adminDir = path.join(__dirname, "../../apps/admin/dist");
      const playerDir = path.join(__dirname, "../../apps/player/dist");

      const deployWeb = new s3deploy.BucketDeployment(this, "DeployWeb", {
        destinationBucket: webBucket,
        distribution: this.webDistribution,
        sources: [s3deploy.Source.asset(webDir)],
      });
      // Player is uploaded after Customer SPA so DeployWeb prune cannot leave /player/ missing.
      const deployPlayer = new s3deploy.BucketDeployment(this, "DeployPlayer", {
        destinationBucket: webBucket,
        destinationKeyPrefix: "player",
        distribution: this.webDistribution,
        distributionPaths: ["/player/*"],
        sources: [s3deploy.Source.asset(playerDir)],
      });
      deployPlayer.node.addDependency(deployWeb);
      new s3deploy.BucketDeployment(this, "DeployAdmin", {
        destinationBucket: adminBucket,
        distribution: this.adminDistribution,
        sources: [s3deploy.Source.asset(adminDir)],
      });
    }

    new cdk.CfnOutput(this, "WebUrl", {
      value: `https://${this.webDistribution.distributionDomainName}`,
      description: "Customer CloudFront URL. Pass to TickerCmsApi as CDK context webOrigin (or TICKER_WEB_ORIGIN).",
      exportName: "TickerCmsWebUrl",
    });
    new cdk.CfnOutput(this, "AdminUrl", { value: `https://${this.adminDistribution.distributionDomainName}` });
  }
}
