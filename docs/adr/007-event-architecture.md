# ADR 007 — EventBridge as the domain event bus

## Status

Accepted.

## Context

Publish, billing, campaign windows, and notifications are asynchronous and must retry independently of the user request.

## Decision

- Application emits events to a custom EventBridge bus.
- Rules route to SQS for processors that need retry/DLQ.
- EventBridge Scheduler for time-based campaign activation and grace end.
- Event schema: CloudEvents-like JSON, `detail-type` versioned.

Avoid chatty events for every keystroke; editor saves are REST; **publish** and **schedule** are events.

## Consequences

- Eventual consistency: UI uses job status + polling (WebSockets later if needed).
- Duplicate events: consumers idempotent (delivery id, webhook id).
