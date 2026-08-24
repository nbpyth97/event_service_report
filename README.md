# Meeting Scheduler

B2B multi-tenant booking SaaS for service businesses (salons, clinics, etc.). Each **Company** (tenant) has staff who manage **Services** and approve/decline **Agendamentos** (bookings) made against them, either by staff directly or by customers through an unauthenticated public booking page.

## Stack

- **Backend**: FastAPI, async SQLAlchemy 2.0 (asyncpg), Alembic, `uv` — `src/backend/`
- **Frontend**: React + TypeScript + Vite + TanStack Query — `src/frontend/`
- **DB**: Postgres 16 (Docker), tenant isolation enforced at the application layer
- **Auth**: JWT access token (in-memory) + httpOnly refresh cookie, no role system — every account is staff of its own company
- **Infra**: nginx reverse proxy (`infra/nginx/`), GitHub Actions deploy (`.github/workflows/deploy.yml`)

## Getting started

```sh
cp .env.example .env   # fill in SECRET_KEY, Postgres creds, etc.
./infra/scripts/start-dev.sh
```

This brings up Postgres + the backend via Docker Compose (`:8000`) and runs the frontend with plain `npm run dev` (`:5173`), not containerized.

## Tests

The test suite talks to the real Postgres container, so it has to run inside the backend container:

```sh
docker compose up -d --build backend
docker compose exec -T backend uv run --group dev pytest -q
```

## Two surfaces

- **Public** (`/marcar-agendamento`, no login): a customer books by name + phone, no account needed.
- **Staff** (`/`, `/agendamentos`, `/servicos`, `/clientes`, `/definicoes`, behind login): manage services, review/confirm/decline bookings, edit company settings.

## More detail

- [`CLAUDE.md`](./CLAUDE.md) — architecture quick-reference, data model, domain rules
- [`REFACTOR_CONTINUATION.md`](./REFACTOR_CONTINUATION.md) — phase-by-phase status of the ongoing rewrite
- [`backlog.md`](./backlog.md) — informal notes and open items
