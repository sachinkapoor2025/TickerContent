# ADR 006 — Subscription enforcement via Entitlement Service

## Status

Accepted.

## Context

Legacy portal displayed Deactive subscription while remaining usable. Plan checks scattered in UI will regress.

## Decision

- Stripe (or equivalent) updates `Subscription`.
- `EntitlementService.evaluate(orgId)` returns a snapshot: flags + numeric limits + remaining usage.
- Cache in memory/Dynamo with short TTL; invalidate on `entitlements.recomputed`.
- Middleware maps routes to required keys (e.g. `devices.pair`, `ai.copilot`, `content.publish`, `data.market`).
- UI may hide features using `GET /entitlements/me` but never as the only control.
- Admin overrides stored as first-class rows with expiry.

Restricted mode is a **computed view** of entitlements, not a separate app.

## Consequences

- New features must register entitlement keys.
- Tests must cover expired/grace/cancelled/suspended.
- Devices already holding a snapshot: policy default is **continue last snapshot** but **refuse new publishes** when publish entitlement is false (configurable).
