# ADR 012 — Frontend: React + TypeScript SPAs

## Status

Accepted.

## Context

Need a modern, accessible, componentized editor and admin. Shared compositor must run in browser and player.

## Decision

- React + TypeScript + Vite.
- Two apps (`web`, `admin`) sharing `packages/ui` and `packages/composition`.
- No business rules in presentational components; hooks call API client.
- Editor undo/redo lives in an editor store; server remains source of truth after save.

Not Next.js SSR for MVP (auth and editor are app-like; CloudFront static hosting is simpler with Cognito). Revisit if SEO of marketing site is in this repo (it should be a separate marketing site).

## Consequences

- Deep linking and chatbot navigation are client routes.
- Preview iframe uses `apps/player` to maximize WYSIWYG.
