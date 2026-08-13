# Meeting Scheduler / event_service_report

B2B multi-tenant booking SaaS for service businesses (pilot tenant: a beauty salon, "anabela"). Each **Company** (tenant) has staff who manage **Services** and approve/decline **Agendamentos** (bookings) made against those services. Being rewritten from a Supabase-backed pair of static SPAs (`dashboard/`, `booking-site/`, no accounts, no RLS) into a proper FastAPI + Postgres + React stack — see `REFACTOR_CONTINUATION.md` for phase-by-phase status and `i-need-to-create-adaptive-donut.md` for the full original architecture plan/rationale. Read those two before making structural changes; this file is the quick-reference map.

## Stack

- **Backend**: FastAPI, async SQLAlchemy 2.0 (`asyncpg`), Alembic migrations, `uv` for deps. `src/backend/app/`.
- **Frontend**: React + TypeScript + Vite + TanStack Query. `src/frontend/src/`.
- **DB**: Postgres 16 (Docker), one schema, tenant isolation enforced at the **application/service layer** (every query filters `tenant_id` explicitly) — not native RLS.
- **Dev**: `infra/scripts/start-dev.sh` — brings up `postgres`+`backend` via `docker compose`, runs frontend with plain `npm run dev` (not containerized). Backend on `:8000`, frontend on `:5173`.

## Data model (`src/backend/app/core/models.py`)

```
Company (tenant)
  id, slug (unique, public), name, settings (JSONB: timezone, business_hours, slot_interval_min, min_lead_time_min)
   │
   ├─< User            (tenant_id FK, name unique per-tenant, password_hash, role: admin|user)
   │     │
   │     └─< RefreshToken (user_id FK, jti, expires_at, revoked_at)  — real server-side revocation
   │
   ├─< Service          (tenant_id FK, name, price, duration_min, active, created_by → User)
   │
   └─< Agendamento       (tenant_id FK, service_id FK, created_by FK → User, start_time, end_time,
                           status: pending|confirmed|declined|cancelled)
```

Key relational facts:
- Every tenant-scoped table (`users`, `services`, `agendamentos`) has its own `tenant_id` FK to `companies` — **never** rely on joining through another table to infer tenant; every service-layer query filters `tenant_id` directly.
- **`Agendamento.customer_name` is a property that reads `creator.name`** (`creator` = the `User` who made the booking) — there is currently **no separate `Customer` entity**. The person booking *is* a `User` row with `role="user"` in that tenant. This is a known, deliberate simplification (see `REFACTOR_CONTINUATION.md` Phase 6 note) — the app conflates "customer" and "tenant user account," which is fine for now but is the reason phone/SMS-based booking (discussed below, not yet built) needs a real `Customer` model.
- `Service.created_by` and `Agendamento.created_by` both FK to `User`, not `Company` — audit trail of who created the row.
- Cross-tenant lookups should 404, not 403 (avoids existence leaks) — established pattern in `services_service.py`.

## Auth / RBAC

Two roles only: `admin` (manages Services CRUD for their company, approves/declines Agendamentos) and `user` (reads their company's services, books/views their own Agendamentos, no service mutation). JWT access token (short-lived, in memory on frontend) + httpOnly-cookie refresh token, real revocation via `RefreshToken` table. `app/core/auth.py` / `app/services/auth_service.py` / `app/routers/auth.py`.

## Known gaps / open roadmap (not yet implemented — see chat history and `ai_dev.md`/`backlog.md`)

- **Dashboard ("Painel") is a stub.** `src/frontend/src/pages/DashboardPage.tsx` currently just renders 3 static count cards (services/agendamentos/pending). Phase 6 in `REFACTOR_CONTINUATION.md` is an **open, undecided** scope question: rework the old Supabase-backed `dashboard/` (has real cost/profit/margin analytics, no schema changes needed) vs. build a new simplified mobile-first dashboard against the current schema (loses cost/profit until `Service` gets a `cost` field). Decide that before touching dashboard code.
- **Phone/SMS-verified anonymous booking (designed, not built).** Direction discussed: introduce a `BookingIntent` (tenant_id, service_id, staff_id, starts_at, customer_name, phone, email, status, expires_at, otp_hash, otp_expires_at, attempts) that starts `PENDING_VERIFICATION`, moves to `VERIFIED`→`CONFIRMED` only after OTP verification, else `EXPIRED`. Goal: let customers book without creating an account, using phone number as a temporary verified identity, with `Customer ≠ User` (User = authenticated staff login; Customer = booking identity). Anti-abuse via per-phone/IP/tenant/intent rate limits + attempt caps + resend cooldown, OTP stored hashed only. SMS provider direction: **AWS End User Messaging Notify** for OTP delivery (built-in SMS pumping protection, no sender-ID provisioning), **not** Resend (email-only). This is a real product change from the current "every booking requires a `User` account" model — needs its own schema/migration work, not a small patch.
- **Tenant isolation is currently app-level only.** Path-based tenancy discussed but not implemented: URL slug resolves tenant → must be cross-checked against JWT `tenant_id` → Postgres RLS as defense-in-depth. Currently just JWT `tenant_id` + explicit query filters.

## Reference docs in this repo

- `REFACTOR_CONTINUATION.md` — current phase status, what's done/verified, resume point.
- `i-need-to-create-adaptive-donut.md` — full original architecture plan and rationale for every structural decision.
- `backlog.md`, `auth_to_do.md`, `ai_dev.md` — informal notes/pasted design discussions (Portuguese/English mixed); treat as raw context, not settled decisions, unless cross-confirmed in `REFACTOR_CONTINUATION.md`.
- `README.md` is stale — describes an old unrelated Supabase dashboard app, not this codebase.
