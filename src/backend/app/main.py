from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from app.core.auth import get_current_user
from app.middleware import setup_middleware
from app.routers import agendamentos, auth, companies, customers, health, notifications, services
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

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(services.router, dependencies=[Depends(get_current_user)])
app.include_router(agendamentos.router, dependencies=[Depends(get_current_user)])
app.include_router(companies.router, dependencies=[Depends(get_current_user)])
app.include_router(customers.router, dependencies=[Depends(get_current_user)])
app.include_router(notifications.router)
