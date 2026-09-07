# ADR 009 — AI: Bedrock tool orchestration, no direct data plane

## Status

Accepted.

## Context

Natural language editing and an in-app guide are required. Unbounded codegen or SQL would violate tenant isolation and publish safety.

## Decision

- Amazon Bedrock with tool/function calling.
- Orchestrator implements the pipeline: intent, authz, plan, validate, preview, confirm, execute, audit.
- Tools call the same application services as HTTP handlers.
- Guide chatbot: retrieval over **our help corpus** + current IA; no tool that dumps other users’ content.
- Prompts and completions logged with redaction; retention bounded.

Model choice is config (feature flag), not hardcoded, so we can switch within Bedrock.

## Consequences

- Latency and cost are entitlements.
- Confirmation UX is mandatory for publish/emergency/assign-all-devices.
- Offline devices: AI cannot magically update them until delivery pipeline runs.
