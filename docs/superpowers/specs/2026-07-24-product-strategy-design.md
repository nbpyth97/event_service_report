# Product Strategy: Stay Web, Sell Concierge-Style

## Context

The dashboard (React + Vite + Supabase, deployed on Vercel) plus a WhatsApp
reminder bot (`whatsapp-web.js`) and Google Calendar sync were built for one
real user — Anabela's beauty/waxing studio — as a family project. The
`tenants/` directory was recently extracted from Anabela's hardcoded config,
making the pipeline structurally multi-tenant, though onboarding is still
entirely manual (hand-written `config.json` / `services.json` per tenant,
per-tenant Google OAuth credentials, per-tenant WhatsApp QR login).

The open question: now that it's multi-tenant-capable, does it make sense to
sell this to other small businesses as-is (web), or turn it into a native
app first? This spec covers the decision and the resulting go-to-market
shape, not a code change.

## Decision: Stay web. Do not build a native app.

A native app does not remove the need for a server: Supabase and the
WhatsApp bot (`whatsapp-web.js`, via `LocalAuth` — a persistent, per-tenant
browser session) must run continuously somewhere regardless of what the
client is. An app only changes where the UI renders; it doesn't touch the
backend cost or the operational burden. Building and maintaining native
app(s) on top of that would add App Store/Play Store distribution overhead
and a second (or third) codebase, which doesn't fit a part-time side
project. The "give them an app, no server cost" framing does not hold
technically for this system.

A PWA layer (installable icon, offline shell) is a legitimate later
enhancement — see Roadmap — but is not needed to start selling.

## Business model: free customization pilot, then monthly subscription

For each new customer: build/adjust the dashboard to their actual services
and workflow at no charge first. Once they're using it and want to keep it,
it converts to a flat monthly subscription. The subscription is quoted per
business during onboarding (not a published price-list tier), and covers
hosting (Supabase/Vercel) plus your time keeping their calendar sync (and,
if applicable, WhatsApp reminders) running. Framed to the customer as "we
run and maintain this for you," not as a software license.

**Why:** Pre-revenue, no proof yet that a stranger will pay for this.
Leading with free customization removes the biggest objection (will this
even fit my business?) before asking for money, and avoids over-engineering
pricing tiers before there's a second paying customer to calibrate against.

## Product scope

**Core (included for every customer):**
- Dashboard: revenue/cost/profit tracking, per-service breakdown,
  appointments table, charts — as it exists today for Anabela.
- Google Calendar sync as the source of bookings.

**Optional add-on (offered, not bundled by default):**
- WhatsApp appointment reminders.

**Why separate:** `whatsapp-web.js` is an unofficial WhatsApp Web client.
Per tenant it requires a one-time QR-code link to that business's phone
number, and the session can silently disconnect and need re-linking. It
carries a small risk of the number being flagged by WhatsApp. Bundling it
into the core offering means a WhatsApp hiccup reads to the customer as
"the whole product is broken." Offering it as an explicit add-on scopes
that risk to only the customers who've opted in.

## Onboarding process (manual, owner-run)

No self-serve signup. Per new customer:
1. Conversation to understand their services, pricing, and workflow.
2. Set up Google Calendar OAuth for their account, obtain a token.
3. Write their `tenants/<name>/config.json` and `services.json` (aliases,
   prices, costs) by hand, following the existing Anabela pattern.
4. If they want WhatsApp reminders, scan the QR code once to link their
   business's number.

**Why:** This matches what the code already requires today — no new
engineering needed to start selling. It is intentionally not self-serve;
building signup automation before there's demand to justify it would be
premature for a part-time side project with an unspecified target scale.

## Risk handling

WhatsApp sessions can disconnect without warning. Handle this reactively
(re-link when a customer reports missed reminders or you notice it) rather
than building monitoring/alerting up front — not worth the engineering time
until there are enough WhatsApp customers for it to matter.

## Roadmap / when to revisit

Do not build now. Revisit only when one of these actually happens:
- **Self-serve onboarding / signup automation** — once manual onboarding
  becomes the bottleneck (demand arrives faster than you can hand-configure
  tenants).
- **PWA layer** (installable home-screen icon, on the existing web stack) —
  once a customer explicitly asks for an "app," or after there are 2-3
  paying customers and it's worth the few hours of polish.
- **Native app** — not currently planned; would need a new reason beyond
  "app vs web," since it doesn't solve the backend-cost or onboarding
  problem.

## Out of scope for this spec

- Specific subscription pricing numbers.
- Self-serve signup flow implementation.
- PWA implementation.
- Any code changes — this is a business/product decision, not an
  implementation plan.
