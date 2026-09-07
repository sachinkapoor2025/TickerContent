# ADR 002 — Serverless-first AWS

## Status

Accepted.

## Context

Customer asked for serverless-first and cost-conscious scale from zero to many tenants. Traffic is bursty (publish events, business hours editing), with a steady but simple device heartbeat stream.

## Decision

- Synchronous: API Gateway HTTP API + Lambda.
- Async: EventBridge + SQS + Lambda.
- No ECS/EKS in MVP.
- Introduce a long-running service only if the compositor compile or WebSocket fan-out proves unfit for Lambda (then consider IoT and CloudFront first).

## Consequences

- Local dev uses SAM/CDK + emulators or a deployed dev account.
- Cold starts: keep handlers small; measure before provisioned concurrency.
- VPC required for Aurora; use Lambda in VPC with sufficient ENI/Hyperplane.
