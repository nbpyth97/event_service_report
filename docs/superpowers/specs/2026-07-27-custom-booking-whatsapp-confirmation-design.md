# Custom Booking Site with WhatsApp Owner Confirmation

## Context

Anabela currently uses cal.com for bookings (with "requires confirmation" already
enabled on her service types). The goal is to replace cal.com with a self-built
booking site so the whole pipeline — booking, calendar, dashboard, reminders — is
owned end-to-end and can be resold to other tenants. The new site must:

- Let a customer pick a service and time slot, styled after cal.com's familiar
  calendar-grid + time-slot-list flow (low friction, no learning curve for
  customers).
- Check real-time availability against the tenant's Google Calendar.
- Hold the slot as a tentative event immediately on booking (visible on the
  business owner's phone), so no other customer can grab it.
- Notify the business owner over WhatsApp with a confirm/decline link —
  reusing the existing local whatsapp-web.js bot rather than a paid SMS API.
- On confirm/decline, update Google Calendar and notify the customer over
  WhatsApp too, and (on confirm) surface the booking in the existing Supabase
  tables the dashboard already reads.

This must fit the existing multi-tenant structure (`tenants/<tenant>/config.json`),
the existing Supabase schema (`events`, `clients`, `organizers`, scoped by
`project_id`), and the existing free-tier hosting (Vercel).

## Decisions

These were confirmed with the business owner (menelaus.sp@gmail.com) during
design:

1. **Fully custom booking site**, not a thin layer on top of cal.com.
2. **WhatsApp delivery timing**: a few minutes' delay is acceptable. The
   existing local, scheduled WhatsApp script (Task Scheduler on the owner's
   PC) is extended to also poll for pending confirmations, rather than
   building a second always-on WhatsApp process. (An always-on bot was
   evaluated and rejected — it's the thing that broke last time we tested it:
   whatsapp-web.js session logout + crash on cleanup.)
3. **No-response handling**: a pending booking request stays pending
   indefinitely — no auto-expiry. (Trade-off: a forgotten request can hold a
   slot open indefinitely; accepted deliberately, revisit if it becomes a
   real problem.)
4. **Decline notice to customer**: sent via WhatsApp, using the phone number
   collected on the booking form (same channel as the confirm notice).
5. **Availability rules** (business hours, days closed, slot length): stored
   per-tenant in `tenants/<tenant>/config.json`, configured by us, not
   self-service for the business owner. A self-service hours editor is
   explicitly out of scope for this build.
6. **Booking flow UX**: calendar-grid day picker → scrollable time-slot list
   for the chosen day → short form (name + phone only — no email, since all
   notifications go over WhatsApp). One service per booking, matching
   cal.com's existing per-service-page model. No online payment.

## Architecture

```
Customer                Booking Site (Vercel,       Google Calendar API
  |                       static React + serverless   |
  |--- picks slot ------->  functions)                |
  |                          |--- freebusy check ----->|
  |                          |<--- availability -------|
  |                          |--- create tentative --->|  (event, grey/PENDENTE)
  |<-- "request sent" -------|
                              |
                              |--- insert row ---> Supabase.booking_requests
                                                       (status=pending)
                                                            |
                                          [poll every N min]|
                                                            v
                                   Local WhatsApp script (existing PC,
                                   existing Task Scheduler job, extended)
                                                            |
                                     WhatsApp message w/ signed confirm/
                                     decline link ------> Business owner
                                                            |
                                              taps link     v
                                   Confirm/Decline endpoint (Vercel
                                   serverless function)
                                       |-- update Google Calendar event
                                       |-- update booking_requests row
                                       |-- (on confirm) upsert into
                                       |   events/clients tables, same
                                       |   shape parse_calendar.py writes
                                                            |
                                          [poll every N min]|
                                                            v
                                   Local WhatsApp script sends outcome
                                   to customer's WhatsApp number
```

### New components

- **`booking-site/`** — new Vite/React app, new Vercel project (free tier),
  reads tenant slug the same way `dashboard/` reads `VITE_PROJECT_ID` etc.
  Public-facing, separate from the internal `dashboard/`.
- **`booking-site/api/*`** — Vercel serverless functions (Node), colocated
  with the frontend, no extra hosting needed:
  - `GET /api/availability` — given tenant + service + date, returns open
    slots. Computed from Google Calendar free/busy for that calendar, minus
    business hours from tenant config, minus already-pending/confirmed
    holds.
  - `POST /api/book` — re-validates the slot is still free (source of truth
    is Google Calendar at request time, not what the frontend cached),
    creates the tentative Calendar event, inserts a `booking_requests` row.
  - `GET /api/confirm?token=...` / `GET /api/decline?token=...` — verify the
    signed token, update the Calendar event, update the Supabase row,
    (confirm only) upsert into `events`/`clients`.
- **Supabase table `booking_requests`** (new): `id`, `project_id`, `event_id`
  (Google Calendar event id), `service`, `service_price`, `customer_name`,
  `customer_phone`, `status` (`pending` / `confirmed` / `declined`),
  `confirm_token`, `notified_owner` (bool), `notified_customer` (bool),
  `created_at`, `responded_at`.
- **`whatsapp-bot/index.js`** (extended, not replaced) — in addition to its
  current tomorrow-reminder job, each scheduled run also:
  - sends the owner a message for any `booking_requests` row where
    `notified_owner = false`, then marks it `true`.
  - sends the customer a message for any row where `status != 'pending'` and
    `notified_customer = false`, then marks it `true`.
- **Google OAuth scope upgrade** — from `calendar.readonly` to full
  `calendar` (read/write). Requires one manual re-consent (same
  `InstalledAppFlow` used today) to mint a token with the new scope. The
  resulting refresh token is stored as a Vercel environment variable so the
  serverless functions can mint their own access tokens server-side,
  independent of the local `token_anabela.json` file (which keeps working
  for the existing local pipeline unchanged).

### Security

Confirm/decline links use a signed, single-use token (HMAC over the booking
id + a server-side secret held in a Vercel env var). Guessing or reusing a
token for a different booking, or clicking it twice, is rejected — a second
click on an already-handled booking shows "this request was already
handled," it does not reprocess.

### Error handling

- Google Calendar API failure during `/api/book` → booking fails closed:
  nothing is written to Supabase, customer sees "couldn't complete booking,
  please try again." No silent partial state.
- Two customers racing for the same slot → `/api/book` re-checks freebusy
  immediately before creating the event; the loser gets "slot no longer
  available."
- Local PC / WhatsApp script offline → pending rows simply queue in
  Supabase; nothing is lost, messages go out whenever the script next runs.
  This is an accepted consequence of reusing the scheduled-script pattern
  (decision #2 above), not a bug to fix here.

## Out of scope for this build

- Self-service business-hours editing for the owner.
- Auto-expiry of unanswered booking requests.
- Online payment collection.
- Multiple services in a single booking (cal.com's model today is one
  service per booking page; matched here for consistency).
- Migrating the WhatsApp bot to an always-on process — the scheduled/polling
  model is deliberate, not a placeholder.

## Rollout / testing

Build and verify end-to-end for `anabela` only:
1. Make a test booking as a customer (own phone number).
2. Confirm the tentative event appears correctly on the owner's Google
   Calendar/phone.
3. Confirm the WhatsApp request arrives via the scheduled script.
4. Test both confirm and decline paths, verify Calendar updates and the
   dashboard reflects confirmed bookings.
5. Verify the customer receives the correct outcome message.
