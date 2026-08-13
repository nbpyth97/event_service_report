# Meeting Scheduler — Full Refactor Plan

## Context

`event_service_report` (the actual project root under `meeting-scheduler`) is a live but architecturally thin booking product: two separate Vite/React JSX SPAs (`dashboard/`, `booking-site/`) talking directly to Supabase (anon key from the browser, service-role key from Vercel serverless functions), no accounts, no RLS, no docker, no CI. Tenants are hardcoded JSON folders. `backlog.md` records the intended direction; this plan turns it into an executable architecture, using `C:\Users\nb29373\activity-tracker` as the structural/convention reference for both backend (FastAPI) and frontend (React + TanStack Query), as instructed.

Key decisions locked in during planning (all confirmed with you):
- **Folder structure**: copy activity-tracker's actual flat convention (`app/routers/`, `app/core/{models,schemas,database,auth,config}.py`, `app/services/`) — not the backlog's literal `app/api/v1/endpoints/` sketch.
- **Tenant isolation**: application-level (`tenant_id` filter baked into every service-layer query), not native Postgres RLS.
- **Deployment**: full VPS — Postgres + backend in docker-compose, frontend built and rsynced as static files to the same VPS, nginx in front of both, GitHub Actions CI/CD mirroring activity-tracker's `deploy.yml`.
- **Scope**: this plan covers the core rewrite (auth, RBAC, services CRUD, agendamentos, mobile-first dashboard, dockerized Postgres + S3 backup, CI/CD). Google Calendar sync, the WhatsApp bot, SSE notifications, Google Maps, custom domain, and personal/business email OAuth stay untouched, ported later.
- **Frontend topology**: one app, one build/deploy. There is no anonymous surface anymore — **every route requires a session except `/login` and the registration endpoints**. This is a deliberate product change from today's live behavior (currently anyone can book without an account) — flagging this explicitly since it's a real behavior change, not just internal refactoring.
- **Roles**: two tenant-bound roles (`admin`, `user`) exactly as the backlog specifies, where `user` is the **customer** — someone with an account at a specific company who can view that company's services and book (create) their own agendamentos, but not manage services. `admin` manages services (CRUD) for their company. On top of that, a **separate platform-level `superuser`/ops role** exists outside the tenant model entirely — it is not scoped to any `tenant_id`, can act across all companies, and its concrete power for this plan is force-invalidating all refresh tokens for a given tenant (e.g. incident response). Because it crosses tenant boundaries, it is modeled and authenticated completely separately from the tenant `User`/RBAC system, not as a third enum value on `User.role`.

---

## Part A — Target Architecture

### A.1 Repository layout

New code lives under `event_service_report/src/{backend,frontend}` alongside the existing `booking-site/`, `dashboard/`, `tenants/`, `whatsapp-bot/` (kept running untouched until final cutover, then deleted).

```
event_service_report/
  docker-compose.yml
  docker-compose.dev.yml
  .env.example
  .github/workflows/{ci.yml,deploy.yml}
  infra/
    nginx/meeting-scheduler.conf
    scripts/{run_backup_data.sh,set_backup_cron.sh,start-dev.sh}
  src/backend/
    Dockerfile
    pyproject.toml / uv.lock
    alembic.ini
    alembic/{env.py,versions/0001_initial.py}
    app/
      main.py
      middleware.py
      core/{database.py,models.py,schemas.py,auth.py,config.py}
      routers/{auth.py,platform.py,users.py,services.py,agendamentos.py}
      services/{auth_service.py,platform_service.py,users_service.py,services_service.py,agendamentos_service.py}
      scripts/{seed.py,migrate_from_supabase.py}
  src/frontend/
    Dockerfile          # local dev only, see A.4
    src/
      api/client.ts
      auth/{auth.ts,user.tsx}
      router/ProtectedRoute.tsx
      hooks/queries.ts
      pages/{LoginPage.tsx,RegisterPage.tsx,ServicesPage.tsx,AgendamentosPage.tsx,DashboardPage.tsx}
      components/{ServiceForm.tsx,ServiceList.tsx,AgendamentoForm.tsx,AgendamentoList.tsx,...}
      main.tsx
```

One frontend app, one CI/CD pipeline. Every page sits behind `ProtectedRoute` except `LoginPage`/`RegisterPage`.

### A.2 Backend layout — rationale

Follows activity-tracker's flat convention. Key deltas from the reference (all previously confirmed):

- **Async Postgres, not sync SQLite.** `core/database.py` uses `create_async_engine` (`asyncpg` driver), `async_sessionmaker`, real `pool_size`/`max_overflow` settings from `core/config.py`. Every router/service function is `async def`; `db.query(...)` becomes `await db.execute(select(...))`.
- **Alembic owns the schema** (reference has none — it uses `Base.metadata.create_all` at startup, which this project removes entirely to avoid drift). `alembic/env.py` is wired async-native (`async_engine_from_config` + `connection.run_sync(...)`). The backend container entrypoint runs `alembic upgrade head` before `uvicorn` starts.
- **`core/config.py` is new** (reference scatters `os.environ.get(...)` calls; this project centralizes into Pydantic `Settings` — `database_url`, `db_pool_size`, `db_max_overflow`, `secret_key`, token TTLs, `cookie_secure`, `cors_origins`).
- **No business logic in routers, with no exceptions** — unlike the reference, where `activities.py`/`categories.py` still have inline query logic. Every router here is parse-request → call one `*_service.py` function → return schema. This was your explicit, repeated instruction and is treated as a hard rule across every router.
- **Two independent auth systems**, not one:
  - `app/core/auth.py` — tenant-user JWT/password primitives, `get_current_user` (returns a `User` with `.tenant_id`/`.role`), `require_admin`.
  - Platform (`superuser`) auth lives in its own `PlatformAdmin` model, its own login/refresh/logout endpoints (`app/routers/platform.py`), and its own dependency (`get_current_platform_admin`), so a tenant access token can never be replayed against a platform-only endpoint and vice versa (enforced via a `type` claim in the JWT payload, checked on decode).

### A.3 Alembic

`alembic.ini` sets `script_location = alembic`, leaves `sqlalchemy.url` blank — `env.py` sets it programmatically from `settings.database_url` so there's one source of truth.

`0001_initial.py` creates `companies`, `users`, `services`, `agendamentos`, `refresh_tokens`, `platform_admins`, `platform_refresh_tokens`, plus indices: `ix_users_tenant_id`, a unique composite `(tenant_id, name)` on `users` (login names are unique per company, not globally — a delta from the reference's single-tenant global-unique `name`), `ix_services_tenant_id`, `ix_agendamentos_tenant_id`, and a composite `ix_agendamentos_tenant_id_start_time` since availability/calendar queries always filter tenant + a time range.

### A.4 Infra layout

`docker-compose.yml` (prod): `postgres` (postgres:16-alpine, named volume, `pg_isready` healthcheck), `backend` (build ./src/backend, `depends_on: postgres: condition: service_healthy`, entrypoint runs `alembic upgrade head && uvicorn ...`), `backup_postgres` gated behind `profiles: ["backup"]` — mirrors activity-tracker's `backup_sqlite` pattern exactly (alpine:3.20, no dedicated Dockerfile, inline `apk add aws-cli postgresql16-client` in the entrypoint, gzip, `aws s3 cp` to a date-partitioned S3 key), with the one necessary substitution: `pg_dump -h postgres -U ... -F c` over the compose network (not a read-only volume mount — Postgres isn't a flat file you can safely copy off disk like SQLite) instead of `sqlite3 .backup`.

`infra/scripts/run_backup_data.sh` / `set_backup_cron.sh` — copy the reference scripts near-verbatim (same `docker compose --profile backup up -d --no-deps` → `docker wait` → `docker rm` → log-to-file mechanics, same idempotent daily-cron install), renaming only the service/container names.

`src/frontend/Dockerfile` — reference has none (prod frontend is a static rsync target, not a container). Keep that for prod, but add this Dockerfile for **local dev only** via `docker-compose.dev.yml`, so `infra/scripts/start-dev.sh` can bring up frontend (`:5173`) + backend (`:8000`) with `docker compose -f docker-compose.dev.yml up` without requiring a local Node/uv toolchain — this satisfies the backlog's "bash.sh to spin up local frontend and backend containers" item directly.

`infra/nginx/meeting-scheduler.conf` — 3-tier `limit_req_zone` mirroring the reference exactly (login 5r/m, refresh 30r/m, general `/api/*` 60r/m), full security headers, SSE-aware settings kept dormant for now (not used until the later SSE-notifications phase), blocks `/api/docs`/`/redoc`/`/openapi.json` in production.

### A.5 GitHub Actions

`ci.yml` (new — reference has no test job): on every PR, run backend `pytest` and frontend `tsc --noEmit && npm run build`. `deploy.yml`: push-to-`main`, `concurrency` group, mirrors reference exactly — `npm ci && npm run build` → rsync `dist/` over SSH via `sshpass` → SSH in, `git pull --ff-only && docker compose up -d --build --remove-orphans` (which runs `alembic upgrade head` as part of the backend entrypoint) → poll `/api/health` with retry/backoff.

---

## Part B — Data Model, Auth, Authorization

### B.1 Domain models (`app/core/models.py`)

```
Company
  id: UUID (pk)
  slug: str, unique, indexed        # public identifier a new customer/admin registers against, e.g. "anabela"
  name: str
  settings: JSONB, default={}       # catch-all for timezone/business_hours/etc — see rationale below
  created_at: datetime

User                                  # both business admins and customers live here
  id: UUID (pk)
  tenant_id: UUID, FK(companies.id), nullable=False, indexed
  name: str                           # login identifier — unique PER TENANT via (tenant_id, name), not globally
  password_hash: str
  role: str                           # "admin" | "user" — CHECK constraint + Pydantic Literal
  created_at: datetime

Service
  id: UUID (pk)
  tenant_id: UUID, FK(companies.id), nullable=False, indexed
  name: str
  price: Numeric(10,2)
  duration_min: int
  active: bool, default=True          # soft-delete: admin "delete" = deactivate
  created_by: UUID, FK(users.id)
  created_at, updated_at: datetime

Agendamento
  id: UUID (pk)
  tenant_id: UUID, FK(companies.id), nullable=False, indexed
  service_id: UUID, FK(services.id), nullable=False
  created_by: UUID, FK(users.id), nullable=False    # always a logged-in user now — no anonymous booking
  start_time: DateTime(timezone=True)
  end_time: DateTime(timezone=True)                  # derived from service.duration_min at creation
  status: str                                        # "pending" | "confirmed" | "declined" | "cancelled"
  created_at, updated_at: datetime

RefreshToken                          # tenant-user refresh tokens — enables real revocation
  id: UUID (pk)
  user_id: UUID, FK(users.id), indexed
  jti: str, unique, indexed
  expires_at: datetime
  revoked_at: datetime | None
  created_at: datetime

PlatformAdmin                         # superuser accounts — NOT tenant-scoped, deliberately separate table
  id: UUID (pk)
  name: str, unique
  password_hash: str
  created_at: datetime

PlatformRefreshToken                  # mirrors RefreshToken but for platform admins
  id: UUID (pk)
  platform_admin_id: UUID, FK(platform_admins.id), indexed
  jti: str, unique, indexed
  expires_at: datetime
  revoked_at: datetime | None
  created_at: datetime
```

Why `PlatformAdmin` is a separate table rather than a nullable `tenant_id` + third role value on `User`: every tenant-scoped service function relies on `tenant_id` being non-null and baked into the `WHERE` clause (B.2). Allowing `tenant_id` to be null on the same table for one role would force every one of those functions to special-case it, which is exactly the kind of accidental-cross-tenant-leak risk this design is trying to eliminate. A separate table with its own auth path (B.3) keeps the two concerns — "which company does this belong to" vs "platform ops with no company" — structurally impossible to conflate.

`Company.settings: JSONB` absorbs everything from today's `tenants/anabela/config.json` that isn't one of the four core entities (timezone, business hours, Google Calendar IDs, WhatsApp number) — modeling each as its own column now would be speculative given those integrations are out of scope for this phase; promote a field to a real column only when a phase actually needs to query on it.

`role` stays a plain string with a DB `CHECK (role IN ('admin','user'))` rather than a join table — backlog is explicit ("just 2 types"), a permissions table would be over-engineering for a fixed, closed enum.

### B.2 Tenant isolation & RBAC — where each check lives

**1. Authentication + role gate → dependency** (`app/core/auth.py`)
- `get_current_user(token, db) -> User` — decodes JWT (`type: "access"`), re-fetches the `User` row from Postgres every request (not trusted off the token), returns it with `.tenant_id`/`.role` populated live. This means a role change or (theoretically, since there's only one company per user) any permission change takes effect on the very next request instead of waiting out the token TTL.
- `require_admin(user: User = Depends(get_current_user))` — 403 if `user.role != "admin"`. Applied via `dependencies=[Depends(require_admin)]` on the specific mutating routes (`POST/PATCH/DELETE /api/services/*`), same mechanism the reference already uses for router-level auth gating.
- `get_current_platform_admin(token, db) -> PlatformAdmin` — separate function, decodes a JWT with `type: "platform_access"`; a tenant-user token fails this check immediately since the `type` claim won't match.

**2. Tenant-scoped data access → service layer** (`app/services/*_service.py`)
- Every service function takes `tenant_id` as an explicit, mandatory parameter and bakes it into the query's `WHERE` clause — never "fetch by id, then compare in Python":
  ```python
  async def get_service(db: AsyncSession, tenant_id: UUID, service_id: UUID) -> Service:
      stmt = select(Service).where(Service.id == service_id, Service.tenant_id == tenant_id)
      service = (await db.execute(stmt)).scalar_one_or_none()
      if not service:
          raise NotFoundError()   # router maps to 404
      return service
  ```
  Cross-tenant access returns **404, not 403** — a 403 would confirm to a caller that a resource ID from another company exists at all, which is an enumeration leak. This is the concrete meaning of the backlog's "authorization, not just authentication."
- `services_service.py`: `list_services`, `get_service`, `create_service`, `update_service`, `delete_service` (soft) — routers pass `current_user.tenant_id`/`.id` straight from the auth dependency, never from a client-supplied field.
- `agendamentos_service.py`: `create_agendamento(db, tenant_id, service_id, created_by, payload)` — re-validates `service_id` belongs to `tenant_id` (reuses `get_service`) before creating the booking, and a `user` role can only create bookings under their own `created_by`; listing/managing bookings for the whole company is admin-only (`require_admin`), while a `user` can list/view their own bookings (filtered additionally by `created_by == current_user.id`, on top of the tenant filter).
- `platform_service.py::revoke_all_tokens_for_tenant(db, tenant_id)` — the "invalidate every refresh token for every user of a tenant" capability you asked for: `UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE tenant_id = :tenant_id)`, exposed as `POST /api/platform/tenants/{tenant_id}/revoke-tokens`, gated by `Depends(get_current_platform_admin)` only — no tenant user, however senior, can call this.

Routers stay thin either way: `routers/services.py::create_service` = parse `ServiceCreate` → `services_service.create_service(db, current_user.tenant_id, current_user.id, payload)` → return `ServiceOut`. No `db.query`/`select` anywhere in a router.

### B.3 Auth flow end to end

Two full, independent JWT lifecycles (tenant-user and platform-admin), each adapted from the reference's `core/auth.py`/`routers/auth.py` pattern (JWT access + httpOnly-cookie refresh, `passlib` `CryptContext(schemes=["argon2","bcrypt"], deprecated="auto")` with `verify_and_update_password` transparent upgrade — copied as-is, it's already correct), plus real server-side revocation via the `RefreshToken`/`PlatformRefreshToken` tables (the reference's logout only clears the client cookie, which doesn't actually invalidate a token that's already out in the world — the backlog explicitly requires real invalidation, hence these tables).

**Tenant-user flow**
- `POST /api/auth/register-company` (unauthenticated): creates a new `Company` + its first `User` (`role="admin"`) in one transaction — this is how a new business onboards. `app/services/auth_service.py::register_company_and_admin(db, payload)`.
- `POST /api/auth/register?tenant_slug=...` (unauthenticated): creates a `User` with `role="user"` under an *existing* company, resolved by `slug` from the URL/query — this is how a customer signs up to book with a specific business. `app/services/auth_service.py::register_customer(db, tenant_slug, payload)`. (Adding *staff* to an existing company, as opposed to customers, is a separate admin-only `POST /api/users` gated by `require_admin` — open self-registration into the admin role of an arbitrary company would be a tenant-isolation hole.)
- `POST /api/auth/login` (unauthenticated): `auth_service.authenticate(db, tenant_slug, name, password)` — login is scoped to a specific company (since `name` is only unique per-tenant, the login form needs to know which company it's authenticating against, e.g. via the URL/slug the user arrived on). On success: insert a `RefreshToken` row (`jti`, `expires_at`), `set_refresh_cookie`, return `{access_token, user: {id, name, role, tenant_id}}` — `role`/`tenant_id` go in the body (not trusted JWT claims) purely so the frontend can drive UI.
- `POST /api/auth/refresh`: reads the cookie, decodes `jti`, looks up `RefreshToken` (must exist, not be revoked, not be expired), **rotates** (marks old row revoked, inserts new row + new cookie).
- `POST /api/auth/logout`: decodes the current refresh cookie's `jti`, sets that row's `revoked_at = now()`, then clears the cookie. A stolen token replayed after logout now fails the `revoked_at IS NULL` check.
- Cookie settings identical to reference: `httponly=True`, `secure=settings.cookie_secure`, `samesite="strict"`, `path="/api/auth"`, `max_age` from settings.

**Platform-admin flow** (`app/routers/platform.py`) — structurally identical but fully separate: `POST /api/platform/auth/login` (name+password against `PlatformAdmin`), `/refresh`, `/logout`, all using `PlatformRefreshToken` and a `type: "platform_access"`/`"platform_refresh"` JWT claim so tokens from the two systems are never interchangeable. `platform_admins` rows are created out-of-band (a `scripts/create_platform_admin.py` CLI script run manually on the server — this is intentionally not a self-service HTTP endpoint, since it's your own ops access).

**Frontend** (`src/auth/auth.ts`, `src/auth/user.tsx`, `src/router/ProtectedRoute.tsx`, `src/api/client.ts`) — copied near-verbatim from the reference: access token in a module-level variable only (never localStorage), only `{id, name, role}` persisted to localStorage for optimistic reload, `refreshInFlight` promise dedup for concurrent 401s, `SESSION_CLEARED_EVENT` window event, `request<T>()`'s auto-refresh-once-on-401 with `/api/auth/*` exempted from the retry loop. Every page sits under `ProtectedRoute` except `LoginPage`/`RegisterPage`. Admin-only UI (create/edit/delete service buttons) is hidden client-side via a `user.role === "admin"` check — a UX nicety only, never the actual security boundary (that's `require_admin` server-side).

---

## Part C — Frontend Plan

### C.1 TanStack Query (`src/hooks/queries.ts`)

Centralized, same convention as the reference — one `queryKeys` object, one hook per query/mutation, `onSuccess` invalidates the relevant key(s):

```ts
export const queryKeys = {
  services: (tenantId: string) => ["services", tenantId] as const,
  service: (id: string) => ["service", id] as const,
  agendamentos: (tenantId: string, filters?: AgendamentoFilters) => ["agendamentos", tenantId, filters] as const,
};

export function useServices() {
  const { user } = useCurrentUser();
  return useQuery({ queryKey: queryKeys.services(user!.tenant_id), queryFn: api.services });
}
export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceCreate) => api.createService(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}
```

`src/api/client.ts` gains TS interfaces mirroring the backend `Out` schemas 1:1, same convention as the reference's `Activity`/`Category` types. `src/main.tsx` provider order: `QueryClientProvider > BrowserRouter > CurrentUserProvider > App`, `staleTime: 30_000, refetchOnWindowFocus: true` — revisit per-hook if staff need faster-than-30s agendamento updates once real usage is observed.

### C.2 Mobile-first dashboard rework (structural plan)

Current `dashboard/src/App.jsx` is one 820-line component with raw `useEffect`+Supabase calls and no router.

1. Split into route-level `src/pages/*.tsx` — a single giant component is itself an obstacle to any responsive work, independent of styling.
2. Move all data-fetching into `hooks/queries.ts` (`useDashboardSummary()`, etc.) — this both satisfies the TanStack Query requirement and shrinks the mobile-rework blast radius to presentational JSX only.
3. Mobile-first CSS: single-column stacked cards by default, `min-width` media queries promoting to multi-column at larger breakpoints (the current bad-mobile state is presumably the inverse — desktop-first, squeezed down).
4. Charts: responsive containers, simplified/fewer-series views under a breakpoint, horizontal-scroll containers for wide tables instead of shrinking text unreadably. Invoke the `dataviz` skill when this phase is actually implemented.
5. Introduce `react-router-dom` into the dashboard (it currently has none) for a proper mobile nav pattern (bottom-nav/hamburger) instead of one long scroll.

Sequenced after Phase 5 (frontend integration) since it depends on `hooks/queries.ts` already existing.

---

## Part D — Phased Rollout

**Phase 0 — Security cleanup (independent, do first, unrelated to the architecture work)**
Remove `credentials_anabela.json`/`token_anabela.json` from git history, rotate the underlying Google OAuth credentials in Google Cloud Console (treat the committed ones as compromised regardless of history rewrite), gitignore both filenames.

**Phase 1 — Backend skeleton + schema**
`src/backend` scaffold, `core/config.py`, `core/database.py` (async engine), `core/models.py` (all 7 tables), Alembic wiring + `0001_initial.py`, local Postgres via `docker-compose.yml`, `/api/health` doing a real `SELECT 1`. Exit: `alembic upgrade head` runs clean, `/api/health` returns 200 with DB actually reachable.

**Phase 2 — Auth (both systems)**
`core/auth.py` (both dependency sets), `services/{auth_service,platform_service}.py`, `routers/{auth,platform}.py` — company/admin registration, customer registration under a slug, login/refresh/logout with real revocation, platform login/refresh/logout, and `revoke_all_tokens_for_tenant`. Exit: full curl/Postman walkthrough — register company, register a customer under it, login both, refresh, logout-then-refresh-fails; platform admin can revoke a tenant's tokens and that tenant's users are then forced to re-login.

**Phase 3 — Services CRUD + RBAC**
`services/services_service.py`, `routers/services.py`. Exit: admin CRUDs services scoped to their own tenant; a second tenant's admin gets 404 on the first tenant's service IDs; `role="user"` gets 403 on mutations, 200 on GET.

**Phase 4 — Agendamentos**
`services/agendamentos_service.py`, `routers/agendamentos.py` — `user` creates/views their own bookings, `admin` views/manages all bookings for the company. Exit: a customer account can book a service at their own company, cannot book at another company's service id (404), cannot see other customers' bookings; admin can see/confirm/decline all bookings for their company.

**Phase 5 — Frontend integration**
`src/frontend` scaffold, `api/client.ts`, `auth/{auth.ts,user.tsx}`, `router/ProtectedRoute.tsx`, `hooks/queries.ts`, `pages/{LoginPage,RegisterPage,ServicesPage,AgendamentosPage}.tsx` — including the backlog's explicitly-missing "Tela de cadastro de serviços." Exit: a customer can register, log in, see their company's services, and book; an admin can log in and CRUD services.

**Phase 6 — Dashboard mobile-first rework**
Per Part C.2. Exit: dashboard usable one-handed on a phone viewport, no horizontal overflow.

**Phase 7 — Infra & CI/CD**
`docker-compose.yml` finalized, `infra/scripts/*`, nginx config, `.github/workflows/{ci.yml,deploy.yml}`. Exit: a PR triggers `ci.yml` (pytest + tsc/build); merging to `main` triggers `deploy.yml`, which succeeds against a real VPS and passes the post-deploy health poll.

**Phase 8 — Data migration**
`app/scripts/migrate_from_supabase.py` — not designed in line-by-line detail here (per your earlier scope decision), but scoped explicitly: **inputs** = Supabase service-role connection (`events`, `clients`, `organizers`, `booking_requests`, `service_costs`) + `tenants/*/config.json`/`services.json` on disk; **outputs** = populated `companies`/`users`/`services`/`agendamentos` rows + an old-id→new-id mapping log. Needs an explicit follow-up decision (not resolved here): since booking now requires an account, existing customers captured only as free-text `clients` rows in Supabase have no password — the migration will need to either create placeholder accounts requiring a password-reset-on-first-login, or treat historical bookings as admin-imported records not tied to a live customer login. Flag this to product before running Phase 8.

**Phase 9 — Cutover**
Point DNS/nginx at the new stack, run Phase 8's migration against production data, verify the pilot tenant (anabela) end to end, decommission `booking-site/`, `dashboard/`, the Vercel deployment, and the old Supabase project after a retention window. `whatsapp-bot/` and the Google Calendar integration keep running unmodified through every phase above — porting them into `app/services/` is a separate, later, out-of-scope effort.

---

## Explicitly Out of Scope

Google Calendar sync, WhatsApp bot, SSE notifications, Google Maps embed, custom domain, personal-vs-business Gmail OAuth — all kept running as-is, ported in a later phase. Phase 0 (credential rotation) is called out as independent/immediate specifically because it's a live-secret exposure, not because it's part of the architecture work.

---

## Verification

- **Backend**: `pytest` suite per router/service (auth flows, tenant-isolation 404-not-403 behavior, RBAC 403s, refresh-token revocation) — run via `uv run pytest` locally and in `ci.yml`.
- **End-to-end manual pass per phase**: the "Exit" criteria listed under each Phase D item are the concrete manual/curl checks to run before merging that phase.
- **Frontend**: `tsc --noEmit` + `npm run build` in CI; manual browser pass for each new page (register, login, services CRUD as admin, book as customer, mobile-viewport dashboard check) — since this involves real UI/UX (mobile-first dashboard), actually open it in a browser at a phone viewport width before calling Phase 6 done, per this project's own UI-verification standard.
- **Infra**: `docker compose up` locally brings up `postgres`+`backend` healthy; `docker compose --profile backup up backup_postgres` produces a `.dump.gz` and (once AWS credentials are configured) uploads it to S3; `infra/scripts/start-dev.sh` brings up both dev containers on `:5173`/`:8000`.
- **Deploy**: first real `deploy.yml` run against the VPS should be watched live (not just trusted) — confirm the health-check poll actually passes and the site is reachable post-deploy.
