# ADR 010 — Device communication: IoT Core + snapshot cache

## Status

Accepted.

## Context

Devices are offline often. Continuous full-content HTTP polling is wasteful. User JWTs on a wall-mounted player are a theft risk.

## Decision

- Provision each player as an AWS IoT Thing with unique cert.
- Control plane: MQTT (snapshot version + URL + hash).
- Data plane: HTTPS GET of snapshot from CloudFront.
- Heartbeat: MQTT or HTTPS → DynamoDB.
- Local cache of last good snapshot required.
- Pairing: short-lived claim code bound to org, exchanged for cert (or factory-claimed later).

Protocol buffers vs JSON snapshot: JSON for MVP; compress (gzip) in transit.

## Consequences

- Firmware work is a parallel workstream; MVP player can be a kiosk browser with device agent.
- IoT policy documents must be generated per thing, never `*` subscribe.
