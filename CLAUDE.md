# Meeting Scheduler / event_service_report

B2B multi-tenant booking SaaS for service businesses (pilot tenant: a beauty salon, "anabela"). Each **Company** (tenant) has staff who manage **Services** and approve/decline **Agendamentos** (bookings) made against those services. Being rewritten from a Supabase-backed pair of static SPAs (`dashboard/`, `booking-site/`, no accounts, no RLS) into a proper FastAPI + Postgres + React stack — see `REFACTOR_CONTINUATION.md` for phase-by-phase status and `i-need-to-create-adaptive-donut.md` for the full original architecture plan/rationale. Read those two before making structural changes; this file is the quick-reference map.

## Stack

- **Backend**: FastAPI, async SQLAlchemy 2.0 (`asyncpg`), Alembic migrations, `uv` for deps. `src/backend/app/`. Business logic lives under `app/domains/<name>/` (one subpackage per domain — `agendamentos`, `auth`, `availability`, `companies`, `notifications`, `services`), each with a `repository.py` (DB access) and `service.py` (business rules); routers in `app/routers/` are thin — they just call into the matching domain's `service.py`.
- **Frontend**: React + TypeScript + Vite + TanStack Query. `src/frontend/src/`.
- **DB**: Postgres 16 (Docker), one schema, tenant isolation enforced at the **application/service layer** (every query filters `tenant_id` explicitly) — not native RLS.
- **Dev**: `infra/scripts/start-dev.sh` — brings up `postgres`+`backend` via `docker compose`, runs frontend with plain `npm run dev` (not containerized). Backend on `:8000`, frontend on `:5173`.

## Data model (`src/backend/app/core/models.py`)

```
Company (tenant)
  id, slug (unique, public), name, settings (JSONB: timezone, business_hours, slot_interval_min, min_lead_time_min)
   │
   ├─< User            (tenant_id FK, name unique per-tenant, password_hash, phone)  — staff, no role column
   │     │
   │     └─< RefreshToken (user_id FK, jti, expires_at, revoked_at)  — real server-side revocation
   │
   ├─< Customer        (tenant_id FK, name, phone, alias)  — booking identity, no login
   │                     unique (tenant_id, phone)
   │
   ├─< Service          (tenant_id FK, name, price, duration_min, active, created_by → User)
   │
   └─< Agendamento       (tenant_id FK, service_id FK, customer_id FK → Customer,
                           created_by FK → User (nullable), start_time, end_time,
                           status: pending|confirmed|declined|cancelled)
```

Key relational facts:
- Every tenant-scoped table (`users`, `customers`, `services`, `agendamentos`) has its own `tenant_id` FK to `companies` — **never** rely on joining through another table to infer tenant; every service-layer query filters `tenant_id` directly.
- **`Customer ≠ User`.** `User` is staff who can log in; `Customer` is a booking identity with no account. A booking belongs to a `Customer` (`customer_id`), while `Agendamento.created_by` is a nullable audit trail of *which staff member typed it in* — `NULL` when the customer booked themselves through the public page. `Customer` is resolved find-or-create by `(tenant_id, phone)`, so the same number always lands on one row whether it arrives from staff or from the public page (`domains/customers/service.py::find_or_create_customer`).
- `Service.created_by` and `Agendamento.created_by` both FK to `User`, not `Company` — audit trail of who created the row.
- Cross-tenant lookups should 404, not 403 (avoids existence leaks) — established pattern in `app/domains/services/service.py`.

## Auth

**There are no roles.** Registration is the only path that creates a `User`, so every account that can log in is staff of its company with full rights over that tenant — there is no `role` column, no `require_admin`, and no `isAdmin` branching in the frontend. The customer-facing surface is unauthenticated instead (see below). JWT access token (short-lived, in memory on frontend) + httpOnly-cookie refresh token, real revocation via `RefreshToken` table. `app/core/auth.py` / `app/domains/auth/service.py` / `app/routers/auth.py`.

## Two surfaces: public vs. authenticated

- **Public (no login).** `app/routers/public.py`, prefixed `/api/public/{tenant_slug}` and mounted with no `get_current_user` dependency — company name + business hours, active services, availability, and `POST /book`. On the frontend these are the pages under `src/frontend/src/pages/public/`, routed *outside* `ProtectedRoute`.
- **Authenticated (staff).** Everything else, behind `ProtectedRoute` → `AppShell`.
- Frontend route paths are **Portuguese**: `/entrar`, `/registar`, `/marcar-agendamento` (public); `/`, `/agendamentos`, `/servicos`, `/servicos/:serviceId/marcar`, `/clientes` (staff). The tenant is carried as `?company=<slug>` on public links.
- Components shared by both surfaces are presentational and never fetch — `components/booking/ServiceBookingFlow.tsx` and `components/booking/TimeSlotList.tsx` take slots as props so the public page can feed them from `usePublicAvailability` and the staff page from `useAvailability`. Keep that shape when adding to either surface rather than forking a `Public*` copy.

## Known gaps / open roadmap (not yet implemented — see chat history and `ai_dev.md`/`backlog.md`)

- **Dashboard ("Painel") is a stub.** `src/frontend/src/pages/DashboardPage.tsx` currently just renders 3 static count cards (services/agendamentos/pending). Phase 6 in `REFACTOR_CONTINUATION.md` is an **open, undecided** scope question: rework the old Supabase-backed `dashboard/` (has real cost/profit/margin analytics, no schema changes needed) vs. build a new simplified mobile-first dashboard against the current schema (loses cost/profit until `Service` gets a `cost` field). Decide that before touching dashboard code.
- **Anonymous booking is built; the *verification* half is not.** Customers already book with name + phone and no account (`routers/public.py`, `pages/public/PublicBookingPage.tsx`), but the phone is taken on trust — nothing proves the number belongs to the person booking, and there is no rate limiting or captcha on `POST /api/public/{slug}/book`. Designed but not built: a `BookingIntent` (tenant_id, service_id, staff_id, starts_at, customer_name, phone, email, status, expires_at, otp_hash, otp_expires_at, attempts) starting `PENDING_VERIFICATION` and moving to `VERIFIED`→`CONFIRMED` only after OTP verification, else `EXPIRED`. Anti-abuse via per-phone/IP/tenant/intent rate limits + attempt caps + resend cooldown, OTP stored hashed only. SMS provider direction: **AWS End User Messaging Notify** for OTP delivery (built-in SMS pumping protection, no sender-ID provisioning), **not** Resend (email-only).
- **A customer cannot see or cancel their own booking.** There is no public endpoint to look up a booking after the fact — the public `POST /book` response is discarded by the frontend. The backlog's direction is a time-limited shareable link that shows status and allows cancel (not edit).
- **Tenant isolation is currently app-level only.** Path-based tenancy discussed but not implemented: URL slug resolves tenant → must be cross-checked against JWT `tenant_id` → Postgres RLS as defense-in-depth. Currently just JWT `tenant_id` + explicit query filters.

## Reference docs in this repo

- `REFACTOR_CONTINUATION.md` — current phase status, what's done/verified, resume point.
- `i-need-to-create-adaptive-donut.md` — full original architecture plan and rationale for every structural decision.
- `backlog.md`, `auth_to_do.md`, `ai_dev.md` — informal notes/pasted design discussions (Portuguese/English mixed); treat as raw context, not settled decisions, unless cross-confirmed in `REFACTOR_CONTINUATION.md`.
- `README.md` is stale — describes an old unrelated Supabase dashboard app, not this codebase.
