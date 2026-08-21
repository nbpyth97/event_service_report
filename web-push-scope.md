# Web Push: scope estimate

Not a task, not scheduled — this is a curiosity answer to "how much code would Web Push take on top of the existing in-app notification system," grounded in the actual current architecture. Nothing here should be built without a separate, explicit go-ahead.

## What already exists (confirmed by reading the code)

- `Notification` model (`core/models.py:257-277`), `notifications` domain (`domains/notifications/service.py`, `repository.py`) with an in-process `NotificationHub` (asyncio.Queue fan-out per tenant) fed by Postgres `LISTEN/NOTIFY`.
- Three trigger points already call into notification creation from `domains/agendamentos/service.py`: `notify_booking_pending` (new booking), `resolve_booking_pending` (pending resolved), `notify_booking_cancelled` (confirmed→cancelled).
- SSE delivery: `GET /api/notifications/stream` (`routers/notifications.py`) + `useNotificationStream.ts` (EventSource, reconnects every 5 min for token refresh) + `NotificationBell.tsx`.
- **Nothing push-related exists today**: no service worker, no `manifest.json`, no `PushManager` usage, no `pywebpush`/`py-vapid` in `pyproject.toml`, no subscription storage on `User` or anywhere else. HTTPS is now in place (production nginx config), which push requires.

## Why this is additive, not a re-architecture

The hard part of any push feature — "know when something happened and who to tell" — is already solved by the three existing trigger call sites. Web Push just plugs a second delivery channel into those same three spots; `agendamentos/service.py` itself needs zero changes.

## Rough scope if built

**Backend (~150-200 lines, ~4-5 files)**
- New `PushSubscription` model + migration: `tenant_id`, `user_id` (FK), `endpoint`, `p256dh_key`, `auth_key`, `created_at` — one-to-many (a user can have a phone + laptop subscribed), so a new table, not a column on `User`.
- `domains/notifications/repository.py`: add subscription CRUD (save, list-by-user, delete).
- `domains/notifications/service.py`: add `_send_push(subscription, message)` using `pywebpush` (new dependency), called alongside the existing `_create_and_notify` DB insert at the same three trigger points. Catch per-subscription failures (expired/gone → 410/404 from the push service means delete that subscription row).
- `routers/notifications.py`: add `POST /push-subscription` (save) and `DELETE /push-subscription` (unsubscribe).
- One-time VAPID keypair generation (`py-vapid` CLI or a short script) — private key into `.env` alongside `SECRET_KEY`, public key exposed to the frontend.

**Frontend (~130-150 lines, ~4 files)**
- `public/sw.js` — plain service worker, no framework: `push` listener calls `showNotification()`, `notificationclick` focuses/opens the app. ~30 lines vanilla JS.
- New hook (e.g. `usePushSubscription.ts`): registers the service worker, calls `Notification.requestPermission()` (must be a user gesture — e.g. a toggle, not on page load), `pushManager.subscribe({ applicationServerKey })`, POSTs the resulting subscription to the backend.
- Small settings UI toggle (fits naturally next to `AppearanceCard` in `CompanySettingsPage.tsx`) — "Ativar notificações push".
- `api/client.ts` additions for the two new endpoints.

**Total: roughly 280-350 lines across ~9 files, one new Python dependency (`pywebpush`), zero new npm dependencies** (native browser `PushManager`, no library needed).

## Real gotchas worth knowing before deciding to build it

- **iOS Safari**: Web Push only works there since iOS 16.4+, and *only* for a PWA added to the home screen — not a normal Safari tab. If staff mostly use iPhones in-browser, this is a real gap the in-app SSE bell doesn't have.
- **Permission UX**: the browser's native permission prompt can only be triggered by a user gesture, and if denied, there's no programmatic re-prompt — needs a clear settings toggle with an explanation, not an automatic ask.
- **Subscription lifecycle**: browsers can silently invalidate a subscription; sends need to handle 404/410 by deleting the stale row, or the table accumulates dead subscriptions.

## Verification (if this is ever actually built)

- Backend: `docker compose up -d --build backend`, `docker compose exec -T backend uv run --group dev pytest -q`.
- Manual: subscribe from a real browser, trigger a booking as a different session, confirm the OS-level push notification arrives with the app backgrounded/closed (SSE can't do this — that's the actual capability delta over what exists today).
