# ADR 003 — Data stores: Aurora PostgreSQL, DynamoDB, S3

## Status

Accepted.

## Context

We have relational aggregates (subscriptions, RBAC, content versions, campaigns) and high-write telemetry (heartbeats). Storing heartbeats in Postgres would dominate cost and vacuum. Storing billing graphs only in DynamoDB would fight reporting and transactions.

## Decision

- **Aurora PostgreSQL Serverless v2**: system of record.
- **DynamoDB**: heartbeats, delivery cursors, idempotency keys.
- **S3**: media and compiled snapshots.
- **No OpenSearch** until product search outgrows Postgres `pg_trgm` / filters.

Row-Level Security in Postgres is a **defense in depth** goal (set `app.organization_id` per transaction) plus application filters. Do not rely on RLS alone.

## Consequences

- Dual-write complexity is avoided: telemetry is not the SoR.
- Team must not query DynamoDB for billing truth.
- Backup: Aurora PITR + S3 versioning; DynamoDB PITR on critical tables.
