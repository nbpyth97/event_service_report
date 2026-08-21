import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import User
from app.core.schemas import AgendamentoCreate, AgendamentoOut, AgendamentoStatusHistoryOut, AgendamentoStatusUpdate
from app.domains.agendamentos import service as agendamentos_service
from app.domains.customers import service as customers_service

router = APIRouter(prefix="/agendamentos", tags=["agendamentos"])


@router.get("", response_model=list[AgendamentoOut])
async def list_agendamentos(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await agendamentos_service.list_agendamentos(db, current_user)


@router.post("", response_model=AgendamentoOut, status_code=201)
async def create_agendamento(
    payload: AgendamentoCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Staff manual appointment — the only unauthenticated booking path is the
    public one (see routers/public.py)."""
    customer = await customers_service.get_customer(db, current_user.tenant_id, payload.customer_id)
    return await agendamentos_service.create_agendamento(
        db, current_user.tenant_id, payload.customer_id, payload.service_id, payload.start_time,
        customer_name=customer.customer_known_name, created_by=current_user.id,
    )


@router.patch("/{agendamento_id}/status", response_model=AgendamentoOut)
async def update_status(
    agendamento_id: uuid.UUID,
    payload: AgendamentoStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await agendamentos_service.update_status(db, current_user, agendamento_id, payload.status)


@router.patch("/{agendamento_id}/notify", response_model=AgendamentoOut)
async def notify_agendamento(
    agendamento_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fired alongside the frontend opening the wa.me status-update link —
    records that staff messaged this customer, not that WhatsApp delivered
    anything."""
    return await agendamentos_service.mark_notified(db, current_user, agendamento_id)


@router.get("/{agendamento_id}/history", response_model=list[AgendamentoStatusHistoryOut])
async def get_agendamento_history(
    agendamento_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await agendamentos_service.get_status_history(db, current_user, agendamento_id)
