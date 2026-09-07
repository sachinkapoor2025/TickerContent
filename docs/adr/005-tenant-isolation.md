# ADR 005 — Tenant isolation: shared database, mandatory organization_id

## Status

Accepted.

## Context

Thousands of orgs: database-per-tenant is operationally heavy on Aurora. Pool model is standard for this SaaS shape. Isolation bugs are the main risk.

## Decision

- Shared Aurora cluster, shared schemas.
- `organization_id` on all tenant rows.
- Repository helpers that refuse queries without org scope.
- S3 key prefix isolation + IAM/session policies for any future tenant-issued credentials (MVP: only server-side access).
- Automated IDOR tests swapping IDs across orgs.

Dedicated accounts/clusters reserved for a future enterprise SKU if required.

## Consequences

- No cross-tenant unique constraints on business names without org in the key.
- Platform catalog rows use null org + explicit visibility.
- Support tooling must set tenant context explicitly.
