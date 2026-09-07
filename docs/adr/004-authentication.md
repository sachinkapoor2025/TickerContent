# ADR 004 — Authentication: Cognito + application RBAC

## Status

Accepted.

## Context

Need MFA, password policies, email verification, and hosted flows without building a crypto stack. Authorization must be permission-catalog based and tenant-aware — Cognito groups alone are too coarse.

## Decision

- Amazon Cognito User Pools: `ticker-cms-tenant`, `ticker-cms-platform`.
- Custom attributes minimized; org membership lives in Aurora.
- API authorizer validates JWT; Lambda loads roles/permissions.
- Devices do not use Cognito; they use IoT certificates.

SSO (SAML/OIDC) is an **enterprise entitlement** later, still via Cognito federation.

## Consequences

- Two user pools avoid mixing staff and customers in one directory.
- User can be in many orgs; JWT may carry `org_id` selected at login/switch (custom claim via Pre Token Gen or a session API).
- Impersonation is not a Cognito feature we will fake with shared passwords.
