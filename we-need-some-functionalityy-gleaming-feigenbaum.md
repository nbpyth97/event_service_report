# B2B Admin Reminder/Notification System — Design

## Context

The B2B admin (salon owner/staff, `role="admin"`) currently has no way to know about booking activity except by manually checking the Agendamentos list. This adds a notification/reminder system scoped strictly to that admin persona — not the end customer who books. Two distinct mechanisms:

- **Notification** = event-triggered, fires immediately off an existing state change (new pending booking, a confirmed booking getting cancelled/declined). Backed by a persisted `Notification` table, pushed live via SSE.
- **Reminder** = time-triggered (an upcoming confirmed appointment starting soon). Decision: keep this **frontend-only** for now, computed client-side from data already fetched via TanStack Query, rather than a persisted/backend-triggered event. Rationale: reminders are lower-stakes than the other two (nothing requires approval, nothing is lost if missed), and only exist meaningfully while the admin has the app open anyway — since delivery is in-app-only, a backend sweep would produce a persisted event with no path to reach the admin any sooner than the frontend already can. This avoids adding backend scheduling infra (asyncio sweep, dedup tracking, `reminder_lead_min` setting) for a payoff that doesn't materialize under in-app-only delivery. If reminders ever ned an external channel (email/SMS), a backend-triggered version can be added then — it doesn't block or conflict with this design.

Delivery for the two persisted notification types is in-app only for now (bell icon + panel), pushed live via SSE, backed by Postgres LISTEN/NOTIFY so it works under both current single-instance and future multi-instance deployment without a rewrite.

This plan is the brainstorming output — next step is `writing-plans` to turn it into an execution plan, and the design should also be committed to `docs/superpowers/specs/` as the durable spec doc.

## Scope (from brainstorming Q&A)

Events in scope, backend-persisted (`Notification` table + SSE):
1. New pending booking (`Agendamento.status` becomes `pending`) — needs admin approval.
2. Confirmed booking cancelled/declined (`status` transitions away from `confirmed`).

In scope, frontend-only (no backend persistence):
3. Upcoming confirmed appointment reminder — "starting soon" computed client-side, see Reminders section below.

Explicitly out of scope for this pass: external channels (email/SMS), digest emails, anything for the customer-facing side of the app.

## Data model

New table, denormalized (one row per recipient — admin counts per tenant are small, so this avoids a join table for read-state):

```
Notification
  id: UUID PK
  tenant_id: UUID FK -> companies.id, indexed
  recipient_id: UUID FK -> users.id  (an admin of that tenant)
  type: str  # 'booking_pending' | 'booking_cancelled'
  agendamento_id: UUID FK -> agendamentos.id, nullable
  message: str  # rendered server-side, no client-side type branching needed
  read_at: timestamptz, nullable
  created_at: timestamptz
```

- Fan-out: on trigger, insert one row per admin user of the tenant (`User.role == 'admin'`, same `tenant_id`).
- No reminder type here — reminders are frontend-only, see Reminders section below. No `reminder_lead_min` setting needed on the backend for this pass (the frontend can hardcode or locally configure its own lead window without a schema change).

## Triggers

`booking_pending` / `booking_cancelled`: inserted synchronously inside the existing status-change write path in the agendamentos service layer, same transaction as the booking write. Notification insert failure must not roll back the booking change — wrap in a savepoint / separate try-except so it's best-effort.

## Reminders (frontend-only)

No backend involvement. The admin's booking views already fetch `Agendamento` rows (including `start_time`, `status`) via TanStack Query. Add a derived "starting soon" view:
- A selector/hook that filters the already-fetched confirmed bookings to those where `start_time` falls within a fixed lead window (e.g. next 30 min) of `Date.now()`.
- Recomputed on a `setInterval`/`refetchInterval` tick (e.g. every 5 minutes) — no dedicated polling endpoint, reuses the existing bookings query.
- Rendered as a persistent "Starting soon" section/badge (e.g. on the dashboard or bookings list), not a one-off toast — since it's a live computed state rather than a fire-once event, there's no dedup or "mark as seen" concept to build.
- Out of the `Notification` table/bell entirely — separate UI surface, separate code path.

## Delivery

- REST: `GET /notifications` (paginated, current admin's rows only), `POST /notifications/{id}/read`.
- SSE: `GET /notifications/stream`. On Notification insert, `NOTIFY notifications_channel, '<tenant_id>'` via Postgres. Each backend instance holds one `asyncpg` LISTEN connection and re-dispatches to its locally-connected SSE clients for that tenant. Works identically whether there's one backend instance or many — no Redis dependency.
- Frontend: notification bell in the admin shell/nav, unread-count badge, dropdown/panel listing recent rows. One `EventSource` to `/notifications/stream`; on reconnect (native browser retry), refetch `GET /notifications` — SSE is a live-update signal, not source of truth. Wire into existing TanStack Query cache (invalidate/append on SSE message).

## Testing

- Integration: booking status change produces correct Notification rows for all admins of that tenant and *no* rows for other tenants (tenant isolation, per existing app-level pattern).
- Manual: two admin sessions on the same tenant confirm SSE fan-out and independent per-admin read-state.
- Manual: reminder section shows/hides an appointment correctly as it crosses into and out of the lead window (frontend-only, no backend test needed).

## Files likely touched

- `src/backend/app/core/models.py` — new `Notification` model.
- New Alembic migration for the `notifications` table.
- `src/backend/app/services/agendamentos_service.py` (or wherever status transitions live) — hook in notification inserts.
- New `src/backend/app/services/notifications_service.py` — creation, listing, read-marking, LISTEN/NOTIFY dispatch.
- New `src/backend/app/routers/notifications.py` — REST + SSE endpoints.
- New background task wiring in app startup (LISTEN connection only, no reminder sweep) — likely `src/backend/app/main.py` or an existing lifespan hook.
- Frontend: new notification bell/panel component, `EventSource` hook, wired into the admin shell/nav layout.
- Frontend: new "starting soon" derived hook/section over the existing bookings query — no new backend endpoint.

## Next step

Write the durable spec to `docs/superpowers/specs/2026-08-13-admin-notifications-design.md` and commit it, then invoke `writing-plans` to produce the implementation plan.
