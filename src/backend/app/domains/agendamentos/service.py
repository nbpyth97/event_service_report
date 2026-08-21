import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import BookingStatus
from app.core.models import Agendamento, AgendamentoStatusHistory, User, utcnow
from app.domains.agendamentos import repository
from app.domains.agendamentos.policy import InvalidStatusTransition, validate_transition
from app.domains.availability.service import is_slot_bookable
from app.domains.notifications import service as notifications_service
from app.domains.services.service import get_service


async def create_agendamento(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    customer_id: uuid.UUID,
    service_id: uuid.UUID,
    start_time: datetime,
    customer_name: str,
    created_by: uuid.UUID | None = None,
) -> Agendamento:
    """created_by is the staff member creating this on the admin manual-
    appointment path, or None for a customer's own anonymous booking (see
    routers/public.py) — it's an audit trail, not the booking's identity
    (customer_id is). customer_name is a one-time snapshot for this booking's
    correspondence (see models.py::Agendamento.customer_name) — the caller
    decides what that name is (typed at submission for a public booking,
    customer_known_name as-of-now for a staff-created one)."""
    service = await get_service(db, tenant_id, service_id)
    end_time = start_time + timedelta(minutes=service.duration_min)

    # Same rules the availability picker used to offer this slot in the first
    # place (business hours, slot grid, tenant-wide busy overlap) — see
    # availability/service.py::is_slot_bookable. Keeps the write path from
    # accepting anything the read path wouldn't have shown.
    if not await is_slot_bookable(db, tenant_id, service, start_time):
        raise HTTPException(status_code=409, detail="Horário não está mais disponível")

    agendamento = Agendamento(
        tenant_id=tenant_id,
        service_id=service.id,
        customer_id=customer_id,
        created_by=created_by,
        start_time=start_time,
        end_time=end_time,
        status=BookingStatus.PENDING.value,
        customer_name=customer_name.strip(),
    )
    try:
        await repository.insert(db, agendamento)
    except IntegrityError as exc:
        await db.rollback()  # the failed commit leaves the session unusable otherwise
        # ex_agendamentos_no_overlap fired (see models.py / the b7c4f19a2e30
        # migration): another transaction committed an overlapping booking
        # between our is_slot_bookable check above and this insert. The check
        # is the gate that gives everyone else a good error; this is the
        # backstop for the window it cannot cover. Same 409 either way — from
        # the caller's side it is the identical situation, just lost later.
        raise HTTPException(status_code=409, detail="Horário não está mais disponível") from exc
    result = await get_agendamento(db, tenant_id, agendamento.id)
    await notifications_service.notify_booking_pending(db, tenant_id, result)
    return result


async def get_agendamento(db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID) -> Agendamento:
    agendamento = await repository.fetch_by_id(db, tenant_id, agendamento_id)
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return agendamento


async def list_agendamentos(db: AsyncSession, current_user: User) -> list[Agendamento]:
    """Every booking in the tenant — a User is staff, so there is no narrower
    "only mine" view to fall back to (see core/models.py::User)."""
    return await repository.list_for_tenant(db, current_user.tenant_id)


async def update_status(
    db: AsyncSession, current_user: User, agendamento_id: uuid.UUID, status: BookingStatus
) -> Agendamento:
    """Staff-only by construction — customers have no login to manage their own
    bookings — and restricted only by ALLOWED_TRANSITIONS (see
    agendamentos/policy.py)."""
    tenant_id = current_user.tenant_id
    agendamento = await get_agendamento(db, tenant_id, agendamento_id)
    previous_status = BookingStatus(agendamento.status)
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


async def mark_notified(db: AsyncSession, current_user: User, agendamento_id: uuid.UUID) -> Agendamento:
    """Staff opened the wa.me status-update link — record it so the icon
    reflects "already messaged" across devices/refreshes. Not a delivery
    receipt (wa.me is a client-side redirect); can be called again to
    re-notify without restriction."""
    tenant_id = current_user.tenant_id
    agendamento = await get_agendamento(db, tenant_id, agendamento_id)
    await repository.mark_notified(db, agendamento, utcnow())
    return await get_agendamento(db, tenant_id, agendamento_id)


async def get_status_history(db: AsyncSession, current_user: User, agendamento_id: uuid.UUID) -> list[dict]:
    agendamento = await get_agendamento(db, current_user.tenant_id, agendamento_id)
    entries = [{"from_status": None, "to_status": "pending", "changed_at": agendamento.created_at}]
    history = await repository.list_status_history(db, agendamento_id)
    entries.extend({"from_status": h.from_status, "to_status": h.to_status, "changed_at": h.changed_at} for h in history)
    return entries
