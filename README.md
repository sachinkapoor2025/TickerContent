# Ticker CMS

Greenfield multi-tenant **Ticker Content Management SaaS**. Photonplay Delta is reference only — this is a new product.

## Run locally

```bash
npm install
npm test
npm run dev:api
# other terminal
npm run dev:web
```

- Tenant app: http://localhost:5173  
  Demo: `owner@demo.local` / `Demo@12345`
- Admin app: http://localhost:5174  
  Demo: `admin@tickercms.local` / `Admin@12345`
- API: http://localhost:3001

Stripe is **not** connected yet. Subscription **status still enforces publish and device limits**. Use Account → Subscription to simulate `expired` / `active`.

## AWS

GitHub Actions `Deploy AWS` uses repository secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

It builds the apps and deploys CloudFront + S3 for the tenant and admin SPAs via CDK (`infrastructure/`). The API still runs locally (SQLite) until Aurora is provisioned.

## Docs

Planning: [docs/README.md](./docs/README.md)
