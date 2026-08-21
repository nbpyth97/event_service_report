from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI

from app.core.auth import get_current_user
from app.middleware import setup_middleware
from app.routers import agendamentos, auth, companies, customers, health, notifications, public, services
from app.domains.notifications.service import listen_for_notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is owned by Alembic (`alembic upgrade head`, run by the container
    # entrypoint before uvicorn starts) — no create_all here, to avoid drift.
    listen_connection = await listen_for_notifications()
    try:
        yield
    finally:
        await listen_connection.close()


app = FastAPI(title="Meeting Scheduler API", lifespan=lifespan)
setup_middleware(app)

# Every router's own prefix is relative (e.g. "/agendamentos", not
# "/api/agendamentos") — "/api" is written exactly once, here, so nginx/
# Vite's proxy boundary and FastAPI's route prefix can never drift apart
# (see infra/nginx/meeting-scheduler.conf's proxy_pass note).
api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(services.router, dependencies=[Depends(get_current_user)])
api_router.include_router(agendamentos.router, dependencies=[Depends(get_current_user)])
api_router.include_router(companies.router, dependencies=[Depends(get_current_user)])
api_router.include_router(customers.router, dependencies=[Depends(get_current_user)])
api_router.include_router(notifications.router)
api_router.include_router(public.router)
app.include_router(api_router)
