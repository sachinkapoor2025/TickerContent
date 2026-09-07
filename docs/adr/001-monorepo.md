# ADR 001 — Monorepo (pnpm + Turborepo)

## Status

Accepted for greenfield.

## Context

Multiple deployables (web, admin, player, API, workers, CDK) must share composition types, OpenAPI clients, and UI. Multi-repo would slow the compositor-as-source-of-truth requirement.

## Decision

One GitHub monorepo with pnpm workspaces and Turborepo. Apps and packages as in `docs/architecture.md`.

## Consequences

- Atomic PRs can change renderer + API together.
- CI must use targeted affected builds.
- Access control is at GitHub repo level (admin vs tenant code lives together — acceptable; no separate trust boundary needed yet).
