# ADR 011 — Media: S3 + CloudFront, never database blobs

## Status

Accepted.

## Context

Lottie, images, fonts, and compiled snapshots are large and cacheable. Postgres TOAST and Lambda payloads are the wrong home.

## Decision

- Presigned uploads, async validation, CDN reads.
- Content-addressed object names after validation.
- Platform animation packs under a public prefix; tenant assets private.
- Image/Lottie size and complexity limits enforced before `ready`.

## Consequences

- Publish snapshots must pin asset hashes so CDN mutation cannot change a live show.
- Malware scanning is a pipeline stage; `ready` is not immediate.
