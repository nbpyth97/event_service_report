import uuid
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import BookingStatus, UserRole
from app.core.models import Agendamento, AgendamentoStatusHistory, User
from app.core.schemas import AgendamentoCreate
from app.services.agendamentos import repository
from app.services.agendamentos.policy import InvalidStatusTransition, can_transition, validate_transition
from app.services.notifications import service as notifications_service
from app.services.services.service import get_service


async def create_agendamento(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, payload: AgendamentoCreate
) -> Agendamento:
    service = await get_service(db, tenant_id, payload.service_id)

    agendamento = Agendamento(
        tenant_id=tenant_id,
        service_id=service.id,
        created_by=created_by,
        start_time=payload.start_time,
        end_time=payload.start_time + timedelta(minutes=service.duration_min),
        status=BookingStatus.PENDING.value,
    )
    await repository.insert(db, agendamento)
    result = await get_agendamento(db, tenant_id, agendamento.id)
    await notifications_service.notify_booking_pending(db, tenant_id, result)
    return result


async def get_agendamento(db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID) -> Agendamento:
    agendamento = await repository.fetch_by_id(db, tenant_id, agendamento_id)
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento not found")
    return agendamento


async def list_agendamentos(db: AsyncSession, current_user: User) -> list[Agendamento]:
    created_by = None if current_user.role == UserRole.ADMIN.value else current_user.id
    return await repository.list_for_tenant(db, current_user.tenant_id, created_by=created_by)


async def update_status(
    db: AsyncSession, current_user: User, agendamento_id: uuid.UUID, status: BookingStatus
) -> Agendamento:
    """Admins manage all bookings for their company, gated only by ALLOWED_TRANSITIONS;
    owners may additionally cancel their own booking regardless of its current status
    (see agendamentos/policy.py)."""
    tenant_id = current_user.tenant_id
    agendamento = await get_agendamento(db, tenant_id, agendamento_id)
    is_owner = agendamento.created_by == current_user.id
    role = UserRole(current_user.role)
    previous_status = BookingStatus(agendamento.status)
    if role != UserRole.ADMIN and not can_transition(is_owner=is_owner, new=status):
        raise HTTPException(status_code=404, detail="Agendamento not found")
    try:
        validate_transition(previous_status, status)
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    agendamento.status = status.value
    history = AgendamentoStatusHistory(
        tenant_id=tenant_id,
        agendamento_id=agendamento_id,
        from_status=previous_status.value,
        to_status=status.value,
    )
    await repository.save(db, history)
    result = await get_agendamento(db, tenant_id, agendamento_id)
    if previous_status == BookingStatus.PENDING:
        await notifications_service.resolve_booking_pending(db, tenant_id, agendamento_id)
    if previous_status == BookingStatus.CONFIRMED and status == BookingStatus.CANCELLED:
        await notifications_service.notify_booking_cancelled(db, tenant_id, result)
    return result


async def get_status_history(db: AsyncSession, current_user: User, agendamento_id: uuid.UUID) -> list[dict]:
    agendamento = await get_agendamento(db, current_user.tenant_id, agendamento_id)
    if current_user.role != UserRole.ADMIN.value and agendamento.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Agendamento not found")

    entries = [{"from_status": None, "to_status": "pending", "changed_at": agendamento.created_at}]
    history = await repository.list_status_history(db, agendamento_id)
    entries.extend({"from_status": h.from_status, "to_status": h.to_status, "changed_at": h.changed_at} for h in history)
    return entries
