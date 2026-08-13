# Meeting Scheduler Refactor — Continuation Plan

Status as of 2026-08-11, branch `refactor`. Phases 0–5 and most of Phase 7 are implemented and verified; this file is the resume point for Phase 6 onward. The original architecture plan (data model, auth design, rationale for every decision) is preserved at `C:\Users\nb29373\.claude\plans\i-need-to-create-adaptive-donut.md` — read that first for full context on *why* things are built the way they are. This file only covers what's done and what's left.

## What's done and verified

- **Phase 0 (security cleanup, partial)**: `credentials_anabela.json`/`token_anabela.json` and the root `.env` untracked from git (still on disk, still used by the legacy `google_calendar.py`/`parse_calendar.py` scripts). **Still needs a human**: rotate the Google OAuth credentials in Google Cloud Console (the committed ones must be treated as compromised), and decide whether to purge them from git history entirely (`git filter-repo`/BFG — a history rewrite on a repo with a remote, needs your explicit go-ahead, not something to do unprompted).
- **Phase 1 (backend skeleton)**: `src/backend/` — FastAPI + async SQLAlchemy 2.0 + Postgres, Alembic migrations (`0001_initial.py`, 5 tables), `docker-compose.yml` (`postgres` + `backend` services), real DB-backed `/api/health`. Verified via `docker compose up` end to end.
- **Phase 2 (auth)**: `core/auth.py`, `services/auth_service.py`, `routers/auth.py` — company/admin registration, customer registration under a tenant slug, login/refresh/logout with real server-side refresh-token revocation, and the CLI-only `app/scripts/invalidate_tenant_tokens.py` (deliberately not an HTTP endpoint — see plan Part B.3 for why).
- **Phase 3 (services CRUD + RBAC)**: `services/services_service.py`, `routers/services.py` — admin-only mutations, tenant-scoped queries that return 404 (not 403) across tenants to avoid existence leaks.
- **Phase 4 (agendamentos)**: `services/agendamentos_service.py`, `routers/agendamentos.py` — customers book/view their own; admins manage all for their company.
- **Phase 5 (frontend)**: `src/frontend/` — React + TypeScript + TanStack Query. Auth (token in memory, httpOnly refresh cookie, silent refresh on load), `ProtectedRoute`, toast error handling mapped from HTTP status codes, Login/Register/Services/Agendamentos/Dashboard(stub) pages. `tsc --noEmit` and `npm run build` both clean.
- **Phase 7 (infra/CI), mostly**: `infra/nginx/meeting-scheduler.conf`, `infra/scripts/{run_backup_data.sh,set_backup_cron.sh,start-dev.sh}`, `.github/workflows/{ci.yml,deploy.yml}`. Written per the activity-tracker reference pattern but **not runnable locally** (nginx/CI need a real VPS + GitHub secrets — `SSH_PASSWORD`, `SSH_USER`, `HOST`, `DEPLOY_PATH`, AWS creds — to actually exercise). `start-dev.sh` is runnable: it brings up `postgres`+`backend` via Docker and runs the frontend directly with `npm run dev` (no frontend Dockerfile / dev compose override — removed per your instruction, frontend dev is plain `npm run dev`, not containerized).

A real bug was found and fixed along the way: SQLAlchemy datetime columns needs explicit `DateTime(timezone=True)` — without it, asyncpg rejects writing timezone-aware Python datetimes. Migration `0001_initial.py` was regenerated (not patched) since nothing had been deployed yet.

**Test suite**: `src/backend/tests/` — 7 pytest tests covering the full auth lifecycle, RBAC, and tenant isolation, run against a real throwaway Postgres container. All passing. On Windows, running the suite needs Python 3.12 (not 3.14 — asyncpg has no prebuilt wheels for 3.14 yet) and `pytest-asyncio>=1.0` with `asyncio_default_fixture_loop_scope = "session"` / `asyncio_default_test_loop_scope = "session"` (both already set in `pyproject.toml`) to avoid a Windows-only `ProactorEventLoop` + asyncpg teardown race — this doesn't affect CI (runs on `ubuntu-latest`) or production.

**How to resume verification locally:**
```sh
docker run -d --name ms-postgres-dev -e POSTGRES_DB=meeting_scheduler -e POSTGRES_USER=meeting_scheduler -e POSTGRES_PASSWORD=changeme -p 5433:5432 postgres:16-alpine
cd src/backend
uv run alembic upgrade head
uv run pytest -v
```
(The committed `src/backend/.env` — actually gitignored, check it still exists locally — points `DATABASE_URL` at `localhost:5433`, matching the port above.)

## Open decision: Phase 6 (dashboard mobile-first rework) scope

This was mid-discussion when we paused. The old `dashboard/src/App.jsx` (820 lines, Supabase-backed) does cost/profit/margin/Pareto analytics via a `service_costs` Supabase table and free-text client-name tracking — **neither exists in the new backend's schema**. `Service` has no cost field; `Agendamento` has no separate client-name field since the customer *is* the logged-in `User` (see plan Part B.1). This wasn't an oversight — Phase 8's plan already flagged `service_costs` preservation as an explicit open question.

Two ways to resolve Phase 6, not yet decided:

1. **Rework the OLD dashboard in place** — keep `dashboard/` as its own Supabase-backed app for now, just fix its mobile layout (split the 820-line component into pieces, mobile-first CSS, responsive charts). Preserves all cost/profit features without touching the new backend's schema. Gets decommissioned later in Phase 9 once/if the new backend gains feature parity.
2. **Build a new simplified dashboard in the new frontend** — replace `src/frontend/src/pages/DashboardPage.tsx`'s current stub with a real mobile-first dashboard backed by the new backend, but only showing what the new schema actually has (service/agendamento counts, upcoming bookings, status breakdown). No cost/profit/margin/Pareto until a later phase deliberately adds cost tracking to the schema (a real scope decision, not a small addition — would mean adding a `cost` field to `Service` and a new Alembic migration).

**Decide this first** before writing any Phase 6 code — it changes which files get touched (`dashboard/src/App.jsx` vs `src/frontend/src/pages/DashboardPage.tsx`) and whether schema work is needed.

## Remaining phases

**Phase 6 — Dashboard mobile-first rework** (blocked on the decision above). Once decided, the original plan's Part C.2 structural steps still apply: split into smaller components, move data-fetching into `hooks/queries.ts`-style hooks, mobile-first CSS (single column by default, promote to grid at larger breakpoints — the new frontend's `styles.css` already does this pattern for `DashboardPage`/`.dashboard-cards`, reuse it), responsive charts, add routing if reworking the old app (it currently has none).

**Phase 7 — finish infra/CI verification**. Needs: a real VPS (or at least a test server) to point `deploy.yml`'s SSH steps at, GitHub repo secrets configured, and a real AWS S3 bucket to test the `backup_postgres` compose profile end to end (`docker compose --profile backup up -d --no-deps backup_postgres`, currently only structurally reviewed, not run against real S3 credentials).

**Phase 8 — Supabase data migration script** (`app/scripts/migrate_from_supabase.py`, not yet started). Per the original plan: inputs = Supabase service-role connection (`events`, `clients`, `organizers`, `booking_requests`, `service_costs` tables) + `tenants/*/config.json`/`services.json` on disk; outputs = populated `companies`/`users`/`services`/`agendamentos` rows + an old-id→new-id mapping log. **Two decisions needed before writing this**:
  - Since booking now requires an account, existing customers captured only as free-text `clients` rows in Supabase have no password — create placeholder accounts requiring password-reset-on-first-login, or import historical bookings as admin-owned records not tied to a live customer login?
  - Whether `service_costs` data is preserved at all, which depends on the Phase 6 decision above (if the new schema never gets a cost field, this data has nowhere to go and migration should just drop it, documented as an explicit decision, not a silent loss).

**Phase 9 — cutover**. Point DNS/nginx at the new stack, run the Phase 8 migration against production data, verify the pilot tenant (anabela) end to end, decommission `booking-site/`, `dashboard/`, the Vercel deployment, and the old Supabase project after a retention window. `whatsapp-bot/` and the Google Calendar integration (`google_calendar.py`, `googleAuth.js`/`googleCalendar.js`) keep running unmodified throughout every phase — porting them into `app/services/` is separate, later, out-of-scope work per your earlier decision.

## Everything already committed

Commit `d4dc09d` on branch `refactor` — 71 files, Phases 0–5 + most of Phase 7. Nothing since then is committed; this file itself is uncommitted.
