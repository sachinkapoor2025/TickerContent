import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as efs from "aws-cdk-lib/aws-efs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/** Container listen port. Supplied to the process as PORT. Not 3001. */
export const API_CONTAINER_PORT = 8080;

/** EFS mount inside the task. SQLite and local assets are siblings under this path. */
export const API_DATA_MOUNT = "/mnt/ticker-data";

export const API_DB_PATH = `${API_DATA_MOUNT}/db/ticker-cms.sqlite`;

export const API_ASSETS_DIR = `${API_DATA_MOUNT}/assets`;

export interface TickerCmsApiStackProps extends cdk.StackProps {
  /**
   * Optional image override for unit tests so CDK synth/tests do not require Docker.
   * Production (`bin/app.ts`) uses the repository Dockerfile.
   */
  apiImage?: ecs.ContainerImage;
  /**
   * Customer CloudFront origin for API CORS (WEB_ORIGIN).
   * Pass CDK context `-c webOrigin=https://<customer-distribution>` or TICKER_WEB_ORIGIN.
   * Do not hardcode a production URL. Admin uses same-origin relative /v1 on its own CloudFront.
   */
  webOrigin?: string;
}

/**
 * Presentation API compute origin: one Fargate task behind an ALB, SQLite on EFS.
 * Customer and Admin CloudFront distributions attach this ALB as the /v1 and /health origin.
 */
export class TickerCmsApiStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly fileSystem: efs.FileSystem;
  public readonly assetBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: TickerCmsApiStackProps) {
    super(scope, id, props);

    const webOrigin =
      props?.webOrigin ??
      (this.node.tryGetContext("webOrigin") as string | undefined) ??
      process.env.TICKER_WEB_ORIGIN ??
      "http://localhost:5173";

    const vpc = new ec2.Vpc(this, "ApiVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const albSg = new ec2.SecurityGroup(this, "ApiAlbSg", {
      vpc,
      description: "Ticker CMS API ALB",
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP from internet and future CloudFront origin");

    const taskSg = new ec2.SecurityGroup(this, "ApiTaskSg", {
      vpc,
      description: "Ticker CMS API tasks",
      allowAllOutbound: true,
    });
    taskSg.addIngressRule(albSg, ec2.Port.tcp(API_CONTAINER_PORT), "ALB to API container only");

    this.fileSystem = new efs.FileSystem(this, "ApiDataFs", {
      vpc,
      encrypted: true,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      securityGroup: new ec2.SecurityGroup(this, "ApiEfsSg", {
        vpc,
        description: "Ticker CMS API EFS",
        allowAllOutbound: true,
      }),
    });
    this.fileSystem.connections.allowDefaultPortFrom(taskSg, "NFS from API tasks");

    const accessPoint = this.fileSystem.addAccessPoint("ApiDataAp", {
      path: "/ticker-data",
      posixUser: { uid: "1000", gid: "1000" },
      createAcl: {
        ownerUid: "1000",
        ownerGid: "1000",
        permissions: "750",
      },
    });

    const jwtSecret = new secretsmanager.Secret(this, "ApiJwtSecret", {
      description: "JWT signing secret for the Ticker CMS presentation API",
      generateSecretString: {
        passwordLength: 48,
        excludePunctuation: true,
      },
    });

    this.cluster = new ecs.Cluster(this, "ApiCluster", { vpc });

    const image =
      props?.apiImage ??
      ecs.ContainerImage.fromAsset(path.join(__dirname, "../.."), {
        file: "services/api/Dockerfile",
        platform: ecr_assets.Platform.LINUX_AMD64,
      });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "ApiTask", {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    taskDefinition.addVolume({
      name: "ticker-data",
      efsVolumeConfiguration: {
        fileSystemId: this.fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: {
          accessPointId: accessPoint.accessPointId,
          iam: "ENABLED",
        },
      },
    });

    this.fileSystem.grantRootAccess(taskDefinition.taskRole);

    this.assetBucket = new s3.Bucket(this, "ApiAssetBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: "TickerCmsAssetObjects",
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [this.assetBucket.arnForObjects("*")],
      }),
    );

    const logGroup = new logs.LogGroup(this, "ApiLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const container = taskDefinition.addContainer("Api", {
      image,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "ticker-cms-api",
        logGroup,
      }),
      environment: {
        NODE_ENV: "production",
        PORT: String(API_CONTAINER_PORT),
        WEB_ORIGIN: webOrigin,
        TICKER_DATA_DIR: API_DATA_MOUNT,
        TICKER_DB_PATH: API_DB_PATH,
        ASSET_STORAGE: "s3",
        ASSET_BUCKET: this.assetBucket.bucketName,
      },
      secrets: {
        JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
      },
      command: ["npm", "run", "start", "-w", "@ticker-cms/api"],
      portMappings: [
        {
          containerPort: API_CONTAINER_PORT,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    container.addMountPoints({
      sourceVolume: "ticker-data",
      containerPath: API_DATA_MOUNT,
      readOnly: false,
    });

    this.alb = new elbv2.ApplicationLoadBalancer(this, "ApiAlb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "ApiTg", {
      vpc,
      port: API_CONTAINER_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: "/health",
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    this.alb.addListener("Http", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
    });

    this.service = new ecs.FargateService(this, "ApiService", {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [taskSg],
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      healthCheckGracePeriod: cdk.Duration.seconds(90),
      circuitBreaker: { rollback: true },
      platformVersion: ecs.FargatePlatformVersion.LATEST,
    });
    this.service.attachToApplicationTargetGroup(targetGroup);

    new cdk.CfnOutput(this, "ApiAlbUrl", {
      value: `http://${this.alb.loadBalancerDnsName}`,
      description: "Presentation API ALB URL (HTTP). CloudFront uses this origin for /v1 and /health.",
      exportName: "TickerCmsApiAlbUrl",
    });
    new cdk.CfnOutput(this, "ApiAlbDnsName", {
      value: this.alb.loadBalancerDnsName,
      exportName: "TickerCmsApiAlbDnsName",
    });
    new cdk.CfnOutput(this, "ApiClusterName", {
      value: this.cluster.clusterName,
    });
    new cdk.CfnOutput(this, "ApiServiceName", {
      value: this.service.serviceName,
    });
    new cdk.CfnOutput(this, "ApiEfsId", {
      value: this.fileSystem.fileSystemId,
    });
    new cdk.CfnOutput(this, "ApiAssetBucketName", {
      value: this.assetBucket.bucketName,
    });
  }
}
