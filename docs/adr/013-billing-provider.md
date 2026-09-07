# ADR 013 — Billing provider: Stripe Billing

## Status

Accepted, pending commercial confirmation.

## Context

Need subscriptions, invoices, dunning, customer portal, webhooks. AWS does not replace a PSP. Legacy billing is email + activation fees.

## Decision

- Stripe Billing + Customer Portal for payment method and invoices.
- Products/prices map to `Plan` rows (Stripe Price ID stored on Plan).
- Webhooks update Aurora; Stripe remains charge SoR; we remain access SoR.
- If the customer mandates another PSP, keep a `BillingProvider` interface; do not scatter Stripe types in domain code.

## Consequences

- PCI scope stays with Stripe.
- Activation-fee policy must be modeled as Stripe products or one-off invoices, not a banner.
- Sandbox vs live keys via Secrets Manager per environment.
