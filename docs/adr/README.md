# Architecture Decision Records

ADRs capture decisions that must not be rediscovered in code comments.

Status values: **Proposed** | **Accepted** | **Accepted, pending commercial confirmation** | **Superseded**.

| ID | Title |
| --- | --- |
| [001](./001-monorepo.md) | Monorepo (pnpm + Turborepo) |
| [002](./002-serverless-aws.md) | Serverless-first AWS |
| [003](./003-database.md) | Aurora PostgreSQL, DynamoDB, S3 |
| [004](./004-authentication.md) | Cognito + application RBAC |
| [005](./005-tenant-isolation.md) | Shared database, mandatory organization_id |
| [006](./006-subscription-enforcement.md) | Entitlement Service |
| [007](./007-event-architecture.md) | EventBridge domain bus |
| [008](./008-template-engine.md) | Declarative composition + sandbox |
| [009](./009-ai-architecture.md) | Bedrock tools, no direct data plane |
| [010](./010-device-communication.md) | IoT Core + snapshot cache |
| [011](./011-media-delivery.md) | S3 + CloudFront |
| [012](./012-frontend.md) | React + TypeScript SPAs |
| [013](./013-billing-provider.md) | Stripe Billing |

New ADRs are required when a decision would change one of: database, auth, tenancy, billing enforcement, renderer trust model, or device protocol.
