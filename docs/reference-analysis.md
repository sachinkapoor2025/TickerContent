# Phase 0 — Repository and Reference Analysis

Status: complete for planning. Existing systems remain **conceptual reference only**.

Inspected on **2026-09-08**. Demo credentials were used only to walk the live portal. They must not be stored in application config, CI, or production secrets.

## 1. What was inspected

| Source | Location / access | Role |
| --- | --- | --- |
| This git repo | `TickerContent` (`github.com/sachinkapoor2025/TickerContent`) | Empty except README; intended home for the new platform |
| Sibling materials | `/Users/sachinkapoor/Desktop/Tickerplay/` | Not this git repo; Lottie zip, LED demo, discovery HTML |
| Lottie pack | `lottie-animations-json-master/` and `animations-json-master.zip` | Mixed UI Lottie samples + seasonal ticker sprites |
| LED simulator | `ticker_demo.html` / `ticker_demo_64.html` | Pixel-exact LED compositor prototype |
| Simulator architecture note | `lottie-animations-json-master/ARCHITECTURE.md` | Explains the demo renderer, not a SaaS |
| Reference portal | `https://ticker.photonplayinc.com` (Photonplay Delta / Ticker Control Room) | Full nav walkthrough with customer-supplied demo account |
| Public marketing | tickerplay.com / photonplayinc.com | Hardware and content-type language |

No existing backend, database schema, device firmware, or billing integration is present in **this** repository. Nothing in the new system should depend on Photonplay Delta URLs, ASP.NET session cookies, ViewState, or page names.

Other local folders (for example older Tickerplay website copies) were **not** used as a code base. They are out of scope for copy/migrate.

## 2. What we learned — business domain

### 2.1 What a ticker is

A **ticker** is a physical LED matrix (tape, rectangle, or later circular/custom geometry) installed at a customer site. It is identified by a hardware/MAC-style device ID, has a known **matrix size**, color mode, firmware, and cloud connectivity. Content is typically **horizontal, pixel-constrained, and often scrolling**, sometimes mixed with live financial data, RSS, logos, and custom messages.

Observed hardware example (demo device, Settings, 2026-09-08):

- Device name / MAC: `00142D6925`
- Matrix: **32 × 993 pixels, full color**
- Firmware: `PTPL1.0.2`
- Cloud status: **Disconnected** (typo in UI: “Disonnected”)
- Device status: `NA`
- Manufacture date: `2025-05-02` (first-class hardware field)

The LED **simulator** uses a different matrix (on the order of **620×64 / 1024×64** in the demo architecture note) to prove a rendering approach (pixel snap, LED pitch/gap overlay). The SaaS must treat **resolution, orientation, pitch, and geometry as device profile data**, not a single hard-coded size.

### 2.2 Existing portal concepts (Photonplay Delta)

Live walkthrough after login as `Demo_Account_Ticker`:

- Product chrome: **TICKER CONTROL ROOM**, logo Photonplay Systems, copyright 2022
- Signed-in identity: display name **Eric Francosky**, role **`TICKER_ADMIN`**
- Session: cookieless ASP.NET session in the URL `(S(...))`
- Tech: ASP.NET WebForms (`__VIEWSTATE`, `__EVENTVALIDATION`, `__doPostBack`, `btnLogin`)

**Navigation (actual hrefs):**

| Nav | Page | Meaning |
| --- | --- | --- |
| Dashboard | `Dashboard` | Device list + ticker preview slot |
| User Profile | `UserInfo` | Name, contact, email, address, avatar, change password |
| Presets → Stocks | `StockList` | Select stocks, selected list, stock group name |
| Presets → RSS | `RssList` | Type, title, URL (max **192** chars) |
| Presets → Custom Messages | `MsgList` | Title + message (max **256** chars) |
| Presets → Messages Logo | `MsgLogo` | Search symbol, logo height **32 / 24 / 16 px**, Add Logo |
| Settings | `SettingHome` | Hardware card + subscription card |
| Support | `Support` | Talk to Sales (`sales@photonplay.com`) + contact support (email, not a ticket system) |

**Dashboard observations:**

- One device: `00142D6925`, badge **OFFLINE**, overlay **SUBSCRIPTION EXPIRED**
- Thumbnail of a sample strip (stock-style “CAT” graphic) even while expired/offline
- Actions: **Show preview of device**, **Manage content of device**
- Device picker values like `3@32@00142d6925@3203` (opaque packed ID: likely internal id + matrix height + MAC)
- Banner: renew stock subscription **15 days** before expiry to avoid **activation fee**; billing via `billing@tickerplay.com` or `800-966-9329`
- Loading toast: “Loading Data From Server…”
- Guide Tour button exists (legacy onboarding overlay)

**Login marketing copy** still sells **Stock, RSS, Custom Message**. That is the old content model: three preset types, not a composition engine.

**Custom messages in the demo account** are a simple table (title + text), e.g. venue-style greetings. No layers, timing, or animation.

**Logos** are height-constrained to LED row counts (16/24/32 px). That is an important physical constraint to keep conceptually.

**Profile** is a single user record (name, phone, email, free-text address, image). There is no organization switcher, no team invite, no permission catalog.

### 2.3 Subscription pain (confirmed live)

On the demo device Settings card:

- Subscription **Status: Deactive**
- Plan: **Financial data (Annual)**
- Validity: **2025-05-02 to 2025-11-02** (expired relative to 2026-09-08)
- Portal still allows login, navigation, presets, profile edits, and content screens

Dashboard shows **SUBSCRIPTION EXPIRED** as a label, not as an access gate.

This matches the customer’s stated pain: **status is informational**. Access is not a first-class entitlement gate. Renewal is a human process with an activation-fee warning, not webhook-driven SaaS state.

### 2.4 Technology of the existing portal (do not retain)

- ASP.NET WebForms, ViewState, cookieless session URLs
- Server-rendered admin, jQuery-era tables, “Loading Preset … Information”
- Device identity mixed with MAC
- No evidence of modern RBAC, org tenancy, draft/publish, versioning, campaigns, or AI
- Forgot password exists on login; MFA / session inventory not observed

### 2.5 Lottie material

The supplied pack is **not** a production animation catalog. Two families of JSON exist:

**A. Generic UI Lottie (low value as ticker product assets)**

- `ic_fav`, `pagination_indicator`, `floating_action_button`, `animate_tab`
- Typical mobile UI motions (star, FAB, tabs)
- After Effects (`.aep`) sources plus GIFs
- README points at LottieFiles / Airbnb Lottie for generic UI
- Wide canvases not designed as LED sprites

**B. Ticker-oriented seasonal / decorative clips (high conceptual value)**

| File | Name (`nm`) | Size | FPS | Notes |
| --- | --- | --- | --- | --- |
| `pumpkin.json` | “11 tikva” | 512×512 | 60 | Seasonal peekaboo sprite |
| `spider.json` | “13 spider” | 512×512 | 60 | Seasonal peekaboo sprite |
| `new_plane.json` | Biplane | 500×500 | 50 | Overlay that flies across the matrix |
| `shine_rotate.json` | Main Scene | 1080×1080 | 30 | Flourish / shine |

The demo **embeds** Lottie payloads so playback works without network fetches. That is a prototype convenience, not a CDN architecture.

### 2.6 LED simulator — what the demo renderer actually does

From `ARCHITECTURE.md` and `ticker_demo.html`:

1. Logical canvas equals the LED matrix.
2. Scrolling **content strip** is pre-baked: gaps, coin slots, stock symbol, live price/change **fields**, then a static message.
3. `requestAnimationFrame` advances scroll in **integer pixels** (accumulator) so motion stays LED-aligned.
4. Gap segments crossing center fire a tiny event bus → flourish + pagination-dot crossing (GSAP tweens on state objects, not DOM).
5. Lottie-web renders each clip to a **hidden canvas**; the main loop composites sprites after a **threshold / pixel-snap** pass so anti-aliased vectors become hard LED pixels.
6. Independent timers: random stock ticks, plane fly-bys, spider/pumpkin peekaboo show/hide.
7. CSS `image-rendering: pixelated` plus a gap overlay simulates physical LED pitch.

This is a **one-file prototype**, not a CMS. It proves that **preview ≈ device** requires a shared, LED-aware compositor — not a generic HTML page scaled down.

## 3. What should be retained conceptually

- Device as a first-class object (ID, matrix, firmware, connectivity).
- Content types customers already understand: **live data (stocks), feeds (RSS), messages, logos**.
- **Device preview** on the dashboard (“what is on my ticker?”).
- **Presets** as reusable fragments (evolve into templates + animation packs).
- Subscription as something customers already associate with **financial data / device activation**.
- Seasonal overlays (plane, pumpkin, spider) as **composable animation layers**, not one-off HTML.
- Pixel-exact rendering, scroll physics, and hard LED quantization.
- Logo heights that match matrix rows.
- Hardware variety: stock tickers, custom tickers, later circular/flexible tapes.
- Billing contact path and renewal urgency — but as real SaaS state, not a banner.

## 4. What must NOT be retained

- ASP.NET WebForms, ViewState, cookieless session URLs.
- Single-user / `TICKER_ADMIN` model without organizations and a permission catalog.
- Three-silo content (Stocks / RSS / Messages) as the architecture of the editor.
- 192-character RSS URL caps and 256-character message caps as product limits.
- Subscription banners without server-side entitlement enforcement.
- Email-only billing as the system of record.
- Embedding all animations in HTML.
- Copying Photonplay Delta layout, copy, or navigation chrome.
- Assuming Windows desktop software remains the control plane.
- Hard-coding 32×993 or 620×64 as the only display.
- Arbitrary JavaScript from templates executing on devices.
- Treating Lottie UI kits (`ic_fav`, FAB, tabs) as the animation product.
- Storing PII from the demo account in the new product.

## 5. Existing limitations (pain points)

| Area | Limitation observed |
| --- | --- |
| Subscription | Deactive/expired plans still allow portal use; no invoices, grace policy, or webhook state in-product |
| Tenancy | User + devices, not isolated organizations |
| Auth | Simple login + keep-me-logged-in; no MFA, session inventory, or fine-grained RBAC observed |
| Content | Text/list presets; no layer canvas, versions, drafts, or campaigns |
| Scheduling | Not a first-class campaign/priority engine in the observed UI |
| Preview | Button and black preview slot exist; no shared LED compositor with the physical player |
| Delivery | Device offline/disconnected with NA status; no visible ack/retry model for operators |
| Animation | Seasonal clips exist as files/demo, not a catalog with categories, entitlements, or packing |
| AI | None |
| Admin | No platform-admin tenancy, plan catalog, or audit trail visible |
| UX | Control-room aesthetic; technical MAC IDs; “preset loading” modals; support is mailto |
| Extensibility | New content types require new pages (`StockList`, `RssList`, `MsgList`) |
| Device ops | Cloud Status disconnected; no health history in the UI we saw |

## 6. New opportunities

- True **SaaS entitlements** (users, devices, storage, AI tokens, animation packs, live data).
- **Organization** as the billing and isolation boundary; optional reseller layer later.
- **JSON composition documents** + modular content plugins (text, image, Lottie, widget).
- **Shared renderer** for editor, dashboard, playback preview, and device player.
- **Campaigns** with priority and recurrence (Diwali window example).
- **Animation packs** as versioned, CDN-delivered catalogs (festivals, alerts, retail).
- **AI copilot** that emits tools (`create_campaign`, `update_content`) with preview + confirm.
- **Context-aware help chatbot** bound to role, plan, and route.
- Event-driven **publish → queue → device MQTT** with offline cache.
- Serverless AWS cost profile that scales with tenants, not always-on servers.
- Marketplace path for templates and animation packs without redesigning storage.

## 7. Assumptions (to be validated with the customer)

A1. Physical devices can run (or be updated to run) a **player** that speaks HTTPS + MQTT, caches a content snapshot, and reports heartbeat/acks. Firmware `PTPL1.0.2` is **not** assumed to be the new protocol.

A2. First commercial hardware profile is **rectangular full-color LED matrices** with known pixel dimensions; circular/flexible geometries are phase-later profiles using the same composition model.

A3. Live financial data remains a **paid entitlement** and an **external market-data contract**, not something we scrape.

A4. Payment processing will be a major PSP (recommendation: Stripe) with AWS-side webhooks; currency starts as USD.

A5. Platform operators need a **separate admin app** (same design system, different auth audience).

A6. “What you see is what the ticker shows” is a **product promise** for the shared compositor, with documented exceptions (hardware brightness, failed assets, offline stale cache).

A7. English-first UI; content payloads can be multi-language from day one.

A8. Greenfield GitHub monorepo; no migration of Delta users/content in MVP unless a later explicit project is funded.

## 8. Missing requirements (open until decided)

See also [implementation-plan.md](./implementation-plan.md) open questions.

- Exact device OS / player runtime (embedded Linux, Android, custom MCU, Windows box).
- Whether pairing is claim-code, factory-provisioned IoT certificate, or both.
- Market-data vendor and licensing terms.
- Plan catalog, prices, trial length, grace days, activation-fee policy.
- Target regions, data residency, and whether multi-region is a year-1 need.
- SLA numbers (availability, publish-to-device latency).
- White-label / reseller scope for MVP vs later.
- Who owns festival pack design (platform vs tenant designers).
- Legal retention period for audit logs and media.
- Whether emergency alerts must work if the cloud is unreachable (local override).
- Whether the existing `PTPL` firmware can be dual-homed during a transition, or devices need a new player image.

## 9. Conclusion

The old portal is a **device-and-preset control room** for Photonplay LED tickers, with a weak subscription overlay. The Lottie pack and LED demo show the **creative ceiling customers actually want**: seasonal sprites, live fields, and pixel-true playback.

The new platform should keep those **domain nouns** (ticker, matrix, stocks, RSS, message, logo, subscription) and replace every **implementation choice** with a multi-tenant, entitlement-enforced, composition-based, event-driven SaaS.
