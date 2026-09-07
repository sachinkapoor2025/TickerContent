# Ticker CMS — Planning Index

Greenfield, subscription-based **Ticker Content Management SaaS**.

This folder is the source of truth for product, architecture, and delivery planning. **No production application code is in this repository yet.** The Photonplay Delta portal (`ticker.photonplayinc.com`) and local Lottie/demo files are **reference only**.

Working name: **Ticker CMS**. Customer-facing brand is TBD; do not assume Photonplay Delta naming, URLs, or UI.

## How to read these documents

| Order | Document | Purpose |
| --- | --- | --- |
| 0 | [reference-analysis.md](./reference-analysis.md) | What we learned from the live portal, Lottie pack, and LED demo — and what we will not copy |
| 1 | [product-requirements.md](./product-requirements.md) | Personas, journeys, functional and non-functional requirements |
| 2 | [domain-model.md](./domain-model.md) | Entities, relationships, and lifecycle states |
| 3 | [architecture.md](./architecture.md) | Target-state AWS, app, data, events, AI, devices, security, observability |
| 4 | [adr/](./adr/) | Architecture decision records |
| 5 | [ux-architecture.md](./ux-architecture.md) | Information architecture, pages, and key workflows |
| 6 | [implementation-plan.md](./implementation-plan.md) | Phased milestones, APIs, tests, definition of done |

## Executive understanding

Ticker CMS is a multi-tenant SaaS platform for organizations that operate physical LED tickers. Customers subscribe, manage devices, design pixel-accurate layouts, schedule campaigns (including seasonal/festival packs), preview playback, and push updates to hardware. Platform admins control tenants, plans, entitlements, content libraries, and support.

The product analogy is **Canva + digital signage CMS + campaign scheduler + SaaS billing + constrained AI copilot**, optimized for **long, low-resolution, often-scrolling LED matrices**, not websites.

The platform spine is:

```
Subscription → Organization → Users/Permissions → Devices → Content → Templates → Animations → Campaigns → Scheduler → Publish → Delivery → Ticker
```

AI never writes the database. It proposes validated tool calls against the same APIs humans use.

## Mapping to the 30 analysis outputs

The numbered list from the kickoff prompt is covered as follows:

1. Executive understanding — this file  
2. Existing-system analysis — [reference-analysis.md](./reference-analysis.md)  
3. Pain-point analysis — reference-analysis + product-requirements  
4. Target-state product vision — product-requirements §1  
5. Personas — product-requirements §2  
6. Core user journeys — product-requirements §3 and ux-architecture  
7. Functional requirements — product-requirements §4  
8. Non-functional requirements — product-requirements §5  
9. Domain model — [domain-model.md](./domain-model.md)  
10–18. Subscription, auth/RBAC, content, templates, animation, campaigns, devices, publishing, AI — domain-model + architecture + ADRs  
19. Chatbot — architecture §7, ux-architecture, ADR 009  
20–23. AWS, data, security, observability — architecture  
24–26. GitHub, CI/CD, testing — architecture §14–16, implementation-plan  
27. Cost — architecture §17  
28–29. Risks and open questions — architecture + implementation-plan  
30. Roadmap — [implementation-plan.md](./implementation-plan.md)

## Planning status

- [x] Phase 0 — Repository and reference analysis (live portal walkthrough 2026-09-08)
- [x] Phase 1 — Product requirements
- [x] Phase 2 — Domain model
- [x] Phase 3 — Target-state architecture
- [x] Phase 4 — ADRs
- [x] Phase 5 — UX / information architecture
- [x] Phase 6 — Implementation plan
- [ ] Phase 7 — Incremental build (not started)

## Quality bar for every later implementation decision

1. Security  
2. Scalability  
3. Tenant isolation  
4. Subscription/entitlement enforcement (server-side)  
5. Content flexibility  
6. Device reliability (including offline)  
7. AI safety  
8. Maintainability  
9. AWS serverless suitability  
10. Future extensibility  
