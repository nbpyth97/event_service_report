import uuid
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.models import Agendamento, User
from app.core.schemas import AgendamentoCreate
from app.services.agendamentos.policy import InvalidStatusTransition, validate_transition
from app.services.notifications import service as notifications_service
from app.services.services.service import get_service


def _with_relations(stmt):
    # AgendamentoOut.customer_name/service_name/etc read these off the ORM
    # object — eager-load so they never trigger a lazy load on an async session.
    return stmt.options(selectinload(Agendamento.service), selectinload(Agendamento.creator))


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
        status="pending",
    )
    db.add(agendamento)
    await db.commit()
    result = await get_agendamento(db, tenant_id, agendamento.id)
    await notifications_service.notify_booking_pending(db, tenant_id, result)
    return result


async def get_agendamento(db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID) -> Agendamento:
    stmt = _with_relations(select(Agendamento)).where(
        Agendamento.id == agendamento_id, Agendamento.tenant_id == tenant_id
    )
    agendamento = (await db.execute(stmt)).scalar_one_or_none()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento not found")
    return agendamento


async def list_agendamentos(db: AsyncSession, current_user: User) -> list[Agendamento]:
    stmt = _with_relations(select(Agendamento)).where(Agendamento.tenant_id == current_user.tenant_id)
    if current_user.role != "admin":
        stmt = stmt.where(Agendamento.created_by == current_user.id)
    stmt = stmt.order_by(Agendamento.start_time)
    return list((await db.execute(stmt)).scalars().all())


async def update_status(
    db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID, status: str
) -> Agendamento:
    """Admin-only (gated by require_admin at the router) — admins manage all bookings for their company."""
    agendamento = await get_agendamento(db, tenant_id, agendamento_id)
    previous_status = agendamento.status
    try:
        validate_transition(previous_status, status)
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    agendamento.status = status
    await db.commit()
    result = await get_agendamento(db, tenant_id, agendamento_id)
    if previous_status == "confirmed" and status == "cancelled":
        await notifications_service.notify_booking_cancelled(db, tenant_id, result)
    return result
