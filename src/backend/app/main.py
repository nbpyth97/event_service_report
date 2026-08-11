from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from app.core.auth import get_current_user
from app.middleware import setup_middleware
from app.routers import agendamentos, auth, health, services


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is owned by Alembic (`alembic upgrade head`, run by the container
    # entrypoint before uvicorn starts) — no create_all here, to avoid drift.
    yield


app = FastAPI(title="Meeting Scheduler API", lifespan=lifespan)
setup_middleware(app)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(services.router, dependencies=[Depends(get_current_user)])
app.include_router(agendamentos.router, dependencies=[Depends(get_current_user)])
