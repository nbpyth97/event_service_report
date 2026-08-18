import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_admin
from app.core.database import get_db
from app.core.models import User
from app.core.schemas import AgendamentoCreate, AgendamentoOut, AgendamentoStatusHistoryOut, AgendamentoStatusUpdate
from app.domains.agendamentos import service as agendamentos_service

router = APIRouter(prefix="/api/agendamentos", tags=["agendamentos"])


@router.get("", response_model=list[AgendamentoOut])
async def list_agendamentos(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await agendamentos_service.list_agendamentos(db, current_user)


@router.post("", response_model=AgendamentoOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_agendamento(
    payload: AgendamentoCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Admin-only manual appointment — the only unauthenticated booking path
    is the public one (see routers/public.py)."""
    return await agendamentos_service.create_agendamento(
        db, current_user.tenant_id, payload.customer_id, payload.service_id, payload.start_time,
        created_by=current_user.id,
    )


@router.patch("/{agendamento_id}/status", response_model=AgendamentoOut, dependencies=[Depends(require_admin)])
async def update_status(
    agendamento_id: uuid.UUID,
    payload: AgendamentoStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await agendamentos_service.update_status(db, current_user, agendamento_id, payload.status)


@router.get("/{agendamento_id}/history", response_model=list[AgendamentoStatusHistoryOut])
async def get_agendamento_history(
    agendamento_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await agendamentos_service.get_status_history(db, current_user, agendamento_id)
