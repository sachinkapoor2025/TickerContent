# Phase 1 — Product Requirements

Product working name: **Ticker CMS** (customer-facing brand TBD; do not assume Photonplay Delta naming).

## 1. Product vision

Give organizations a subscription they can trust, a visual way to design LED ticker experiences, and a reliable path from **draft → preview → publish → device**, including seasonal campaigns and AI assistance that never bypasses permissions.

Success looks like:

- An expired or unpaid tenant cannot publish, cannot consume paid entitlements, and receives a clear billing recovery path — enforced by APIs, not hidden buttons.
- A designer can build a Diwali campaign on a 32×993 (or any profile) canvas, preview LED-accurate playback, and have selected tickers run it between configured dates.
- An operator glancing at the dashboard sees **online/offline**, **what is playing now**, and **failed deliveries**.
- Platform admins can create plans, override entitlements, suspend tenants, and inspect audit history.

## 2. Personas

### Platform

| Persona | Goals | Notes |
| --- | --- | --- |
| Super Admin | Full platform control, break-glass | Few people; MFA mandatory |
| Platform Admin | Tenants, flags, catalogs | Day-to-day ops |
| Support Admin | Time-boxed tenant context, tickets, device health | No billing writes unless granted |
| Billing Admin | Plans, invoices, overrides, dunning | Finance |
| Content Admin | Global templates, animation packs, moderation | Creative ops |

### Tenant

| Persona | Goals |
| --- | --- |
| Organization Owner | Billing, plan, destroy/transfer org, owner roles |
| Organization Admin | Users, devices, settings |
| Content Manager | Campaigns, schedules, publish |
| Designer | Templates, layouts, animations, AI create |
| Operator | Assign playlists, emergency message, monitor devices |
| Viewer | Read-only dashboards and previews |

### Optional later

Reseller/Partner managing multiple orgs — **not MVP**; schema should not block `partner_id` later.

## 3. Core user journeys

1. **Subscribe and onboard** — trial or paid plan → create org → invite users → pair first ticker → see live preview empty state.
2. **Design content** — blank or template → canvas edit → save draft → LED preview → publish.
3. **Seasonal campaign** — pick pack/template → set window, targets, priority → schedule → auto-activate/deactivate.
4. **Emergency override** — operator posts high-priority alert to device group → devices ack → dashboard shows override; expire or cancel restores previous playlist.
5. **Subscription expiry** — dunning → grace (configurable) → entitlements drop → UI and APIs enter restricted mode → restore on payment.
6. **AI assist** — prompt → structured plan → permission check → preview → confirm if high impact → execute → audit.
7. **Help chatbot** — “where is subscription?” → deep link if permitted.
8. **Admin suspend tenant** — devices stop receiving new publishes; portal restricted; audit recorded.

## 4. Functional requirements

IDs are stable for tests and tracing.

### Identity and tenancy

| ID | Requirement |
| --- | --- |
| F-AUTH-01 | Email/password signup and login; logout; password reset; email verification |
| F-AUTH-02 | MFA (TOTP) required for platform roles; optional then required for tenant owners |
| F-AUTH-03 | Session list and revoke; refresh token rotation |
| F-AUTH-04 | Lockout and rate limits on auth endpoints |
| F-AUTH-05 | RBAC + permission catalog; roles are data, not hard-coded checks |
| F-TEN-01 | Every customer resource is scoped to `organization_id` |
| F-TEN-02 | Cross-tenant reads/writes are impossible via public APIs |
| F-TEN-03 | Platform roles operate via a separate audience and explicit tenant context |

### Subscription and billing

| ID | Requirement |
| --- | --- |
| F-SUB-01 | Plans with named entitlements (users, devices, storage, AI, packs, live data, API) |
| F-SUB-02 | Trial, active, past_due, grace, expired, cancelled, suspended |
| F-SUB-03 | Upgrade/downgrade with defined proration policy |
| F-SUB-04 | Invoices, payment attempts, billing history |
| F-SUB-05 | Webhook-driven state; idempotent processing |
| F-SUB-06 | Server-side entitlement checks on every mutating API and on publish/delivery |
| F-SUB-07 | Restricted mode: login allowed for billing/owner; publish and paid features denied |
| F-SUB-08 | Admin override with reason + expiry + audit |
| F-SUB-09 | Failed payment dunning and notifications |

### Devices

| ID | Requirement |
| --- | --- |
| F-DEV-01 | Register/pair, activate, deactivate, replace (successor device inherits assignment) |
| F-DEV-02 | Heartbeat, online/offline with configurable timeout |
| F-DEV-03 | Device groups and tags |
| F-DEV-04 | Profile: resolution, orientation, color mode, firmware, location |
| F-DEV-05 | Remote config where player supports it (brightness, timezone, reboot command — capability flagged) |
| F-DEV-06 | Device logs (connectivity, playback errors) with retention policy |

### Content, templates, animation

| ID | Requirement |
| --- | --- |
| F-CNT-01 | Modular content types: text, image, video (if profile allows), Lottie, SVG, shapes, logos, backgrounds, gradients, clock/date, QR, RSS widget, live data widget, alert |
| F-CNT-02 | Layered composition document (JSON) with timing, transitions, scroll regions |
| F-CNT-03 | Draft vs published; versions; rollback |
| F-CNT-04 | Templates: platform, org; duplicate; version; publish-to-library |
| F-CNT-05 | Animation library with categories and packs; add packs without app deploy (catalog + CDN) |
| F-CNT-06 | Secure renderer: no arbitrary JS on device; HTML only if sanitized subset or compile-to-composition |
| F-CNT-07 | Shared compositor for editor, dashboard, playback preview |

### Campaigns and scheduling

| ID | Requirement |
| --- | --- |
| F-SCH-01 | One-time, recurring (daily/weekly/monthly), date-range, time-range |
| F-SCH-02 | Priority is numeric and configurable per org (defaults provided, not hard-coded hierarchy) |
| F-SCH-03 | Conflict resolution: highest priority wins; ties broken by recency then id |
| F-SCH-04 | Campaigns bind content/template/animation to device or group |
| F-SCH-05 | Emergency flag as a priority class, not a special-case code path |

### Publishing and delivery

| ID | Requirement |
| --- | --- |
| F-PUB-01 | Publish produces an immutable snapshot (content + assets + schedule slice) |
| F-PUB-02 | Devices pull/receive delta or snapshot by version; skip unchanged |
| F-PUB-03 | Ack, retry, dead-letter, delivery status in UI |
| F-PUB-04 | Offline: last good snapshot continues; sync on reconnect |
| F-PUB-05 | Dashboard shows current published snapshot per device |

### AI

| ID | Requirement |
| --- | --- |
| F-AI-01 | Prompt → intent → permission → tool plan → validate → preview → confirm (policy) → execute → audit |
| F-AI-02 | Tools only: create/update content, template, campaign, schedule, assign, preview, animation sequence |
| F-AI-03 | Chatbot: navigation and how-to; no data the user cannot already read |
| F-AI-04 | Plan-based AI quota; hard stop when exhausted |
| F-AI-05 | High-impact tools (publish, emergency, billing-adjacent) always confirm |

### Admin, audit, notifications

| ID | Requirement |
| --- | --- |
| F-ADM-01 | Tenant CRUD, suspend/activate, search |
| F-ADM-02 | Global template and pack management |
| F-ADM-03 | Feature flags |
| F-AUD-01 | Audit log for security- and content-significant actions with before/after, actor, source (human/ai/system), IP |
| F-NTF-01 | Email for billing, device offline thresholds, publish failures |

## 5. Non-functional requirements

Exact SLAs are **undecided** (see open questions). Directional NFRs:

| ID | Topic | Target direction |
| --- | --- | --- |
| NFR-01 | Isolation | Zero tolerated cross-tenant data leaks; automated tests |
| NFR-02 | AuthZ | Default deny; every route maps to a permission + entitlement |
| NFR-03 | Availability | Multi-AZ managed services; design for regional single-home first |
| NFR-04 | Scale path | Thousands of orgs, high heartbeat volume via DynamoDB/IoT, not Postgres chatty writes |
| NFR-05 | Latency | Interactive APIs p95 to be measured; publish is async |
| NFR-06 | Security | Encryption in transit/rest, WAF, least-privilege IAM, secrets in Secrets Manager |
| NFR-07 | Observability | Structured logs, traces, metrics, alarms from milestone 0 |
| NFR-08 | Cost | Serverless-first; heartbeat and logs sampled/aggregated |
| NFR-09 | Accessibility | WCAG 2.2 AA intent for portal (LED hardware itself is not AA) |
| NFR-10 | I18n | UI English; content Unicode; timezone per org and per device |

## 6. Out of scope for MVP (explicit)

- Native mobile apps (responsive web first)
- Public partner API marketplace
- White-label domains
- Multi-region active-active
- Arbitrary HTML/JS template execution on devices
- Migrating Photonplay Delta data
- Circular-ticker unique compositor (profile stub only)

## 7. Subscription model (product)

Default **starter catalog** (prices TBD):

| Plan | Intent | Example entitlements |
| --- | --- | --- |
| Trial | Time-boxed | 1–2 devices, watermark or pack limits, AI cap |
| Starter | Small business | Few devices, templates, no live market data |
| Professional | Retail / office | More devices, campaigns, animation packs, AI |
| Financial | Live data | Market-data entitlement + device counts |
| Enterprise | Later | SSO, API, higher limits, support SLA |

Enforcement is **entitlement keys**, not plan names in `if (plan === 'pro')` scattered in UI.

Restricted mode capabilities (MVP):

- Allowed: login, billing portal, read-only dashboard, contact support
- Denied: publish, AI mutations, new devices, pack downloads, live data widgets

Device policy when publish is denied: **keep last legally published snapshot** unless the org is suspended (then optional blank/branded “service paused” snapshot — product decision, default keep last).

## 8. Content model (product)

Three layers:

1. **Design** — composition JSON (layers, styles, animations, bindings).
2. **Data** — bound values (headline text, RSS items, quotes, clock timezone).
3. **Render** — LED compositor consumes a **compiled snapshot**.

Widgets (clock, RSS, quotes) declare refresh policy. Devices never poll arbitrary URLs unless the snapshot includes an allowlisted connector result or a signed feed proxy.

## 9. Device model (product)

`Ticker` (logical display in the org) vs `Device` (physical player). MVP may 1:1 them; replacement uses a new device record linked as successor.

States: `pending_pair` → `active` → `deactivated` | `replaced`.

Connectivity: `online` | `offline` | `unknown` derived from heartbeat.

## 10. AI requirements (product)

Two products, one governance layer:

- **Creator copilot** in the editor and campaign screens.
- **Portal guide** chatbot (global).

Both share: auth, tenant, permissions, entitlements, audit, PII minimization (no packing other tenants into prompts).

## 11. Admin requirements (product)

Dedicated admin application. Support “view as tenant” is **optional, audited, time-boxed**, and disabled until milestone with legal approval. MVP can operate with tenant-id switcher for platform admins without full impersonation of a user session.
