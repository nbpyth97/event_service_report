import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_admin
from app.core.database import get_db
from app.core.models import User
from app.core.schemas import AgendamentoCreate, AgendamentoOut, AgendamentoStatusUpdate
from app.services import agendamentos_service

router = APIRouter(prefix="/api/agendamentos", tags=["agendamentos"])


@router.get("", response_model=list[AgendamentoOut])
async def list_agendamentos(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await agendamentos_service.list_agendamentos(db, current_user)


@router.post("", response_model=AgendamentoOut, status_code=201)
async def create_agendamento(
    payload: AgendamentoCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await agendamentos_service.create_agendamento(db, current_user.tenant_id, current_user.id, payload)


@router.patch("/{agendamento_id}/status", response_model=AgendamentoOut, dependencies=[Depends(require_admin)])
async def update_status(
    agendamento_id: uuid.UUID,
    payload: AgendamentoStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await agendamentos_service.update_status(db, current_user.tenant_id, agendamento_id, payload.status)
