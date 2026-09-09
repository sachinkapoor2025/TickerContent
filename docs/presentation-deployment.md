# Presentation AWS deployment

This describes how the Ticker CMS **presentation** environment is deployed from GitHub Actions and CDK.

Do not put secret values in this file. Do not treat this document as a live URL list; CloudFront domains are generated at deploy time.

## Required GitHub secrets

Configure these repository secrets (values are already expected by the existing workflow):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

Do not add `JWT_SECRET` to GitHub. The API stack creates that secret in AWS Secrets Manager and injects it into the ECS task.

Do not put AWS keys in the Dockerfile, React apps, `.env` committed to git, or CDK source.

## Optional GitHub variable

- `TICKER_WEB_ORIGIN` — Customer CloudFront URL (`https://<distribution>.cloudfront.net`)

This is a public URL, not a secret. After the first successful deploy you may store the `WebUrl` stack output here. The workflow also reads `WebUrl` from the existing `TickerCmsFrontend` stack when present.

## Architecture deployed

| Surface | Stack | Origin |
| --- | --- | --- |
| Customer SPA | `TickerCmsFrontend` | private S3 + CloudFront |
| Admin SPA | `TickerCmsFrontend` | private S3 + CloudFront |
| API | `TickerCmsApi` | ECS Fargate (1 task) behind an ALB; SQLite on EFS; private S3 assets |

CloudFront routes `/v1/*` and `/health` to the API ALB. All other paths stay on the SPA S3 origins.

Player is **not** deployed by this pipeline.

## WEB_ORIGIN (two-phase)

`WEB_ORIGIN` cannot be taken from the Customer CloudFront URL at the same time the API stack is first created without a circular CDK dependency (Frontend already depends on the API ALB).

1. **First deploy:** `cdk deploy --all` creates the API and both CloudFront distributions. If no previous `WebUrl` or `TICKER_WEB_ORIGIN` exists, the API may start with the local default CORS origin.
2. **Same workflow run:** the workflow reads `WebUrl` and, if it differs, runs `cdk deploy TickerCmsApi -c webOrigin=<WebUrl>` so the API task receives `WEB_ORIGIN=https://<customer-cloudfront-domain>`.
3. **Later deploys:** the existing `WebUrl` is passed into the initial `cdk deploy --all`, so the API is not reverted to localhost.

Do not hardcode a CloudFront URL in source. Do not leave localhost as the permanent production CORS origin.

## Workflow

1. GitHub Actions → **Deploy AWS** → Run workflow
2. Set **confirm** to exactly `deploy`
3. The job then:

   1. `npm ci`
   2. `npm test`
   3. `npm run typecheck`
   4. `npm run build`
   5. `npx cdk synth` (in `infrastructure/`)
   6. `npx cdk bootstrap` (idempotent; kept for first-time CDK in the account/region)
   7. `npx cdk deploy --all` (CDK deploys `TickerCmsApi` before `TickerCmsFrontend` because of the ALB reference)
   8. Optional API update for `WEB_ORIGIN`
   9. `aws ecs wait services-stable`
   10. Smoke checks (JSON, not HTML)

Auto-deploy on push to `main` is **disabled** so this pipeline cannot run until it is explicitly started.

## Expected stack outputs

From `TickerCmsFrontend`:

- `WebUrl` — Customer CloudFront HTTPS URL
- `AdminUrl` — Admin CloudFront HTTPS URL

From `TickerCmsApi`:

- `ApiAlbUrl` — API ALB HTTP URL (origin; browsers should use CloudFront)
- `ApiClusterName` / `ApiServiceName`
- `ApiEfsId`
- `ApiAssetBucketName`

## Health verification

Unauthenticated checks only. No demo passwords are used.

- ALB: `GET /health` → JSON `{ "ok": true, "service": "ticker-cms-api" }`
- Customer CloudFront: `GET /health` → same JSON
- Customer CloudFront: `POST /v1/auth/login` with a fake email → JSON error, **not** `index.html`
- Admin CloudFront: `GET /health` → same JSON

HTTP 200 HTML is treated as failure.

Local helper:

```bash
cd infrastructure
npx ts-node --prefer-ts-exts scripts/presentation-smoke.ts --alb-url <ApiAlbUrl> --web-url <WebUrl> --admin-url <AdminUrl>
```

## Safety

- Normal deploys update stacks; they do not delete EFS, empty the asset bucket, or reset SQLite.
- The workflow does not destroy stacks or run rollback/delete commands.
- The ECS task uses its IAM role for S3. AWS access keys stay in GitHub secrets for CDK/CLI only.
