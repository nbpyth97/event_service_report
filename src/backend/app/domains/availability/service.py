import uuid
from datetime import date as date_cls
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company, Service
from app.domains.availability import repository
from app.domains.companies import repository as companies_repository
from app.domains.services.service import get_service

DOW_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")  # date.weekday(): 0=Mon..6=Sun


async def get_available_slots(
    db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID, day: date_cls
) -> list[datetime]:
    """DB-only availability: candidate slots minus anything overlapping an
    existing pending/confirmed agendamento for the tenant (busy is tenant-wide,
    not per-service — one business can't run two services on the same person
    at once)."""
    service = await get_service(db, tenant_id, service_id)
    company = await companies_repository.fetch_by_id(db, tenant_id)
    return await _candidate_slots(db, tenant_id, service, company, day)


async def is_slot_bookable(db: AsyncSession, tenant_id: uuid.UUID, service: Service, start_time: datetime) -> bool:
    """The write-path counterpart of get_available_slots: same business-hours,
    slot-grid, lead-time and tenant-wide busy-overlap rules, applied to one
    specific start_time rather than enumerated over a whole day. A slot the
    picker never offered can never be booked either, and vice versa."""
    company = await companies_repository.fetch_by_id(db, tenant_id)
    tz = ZoneInfo((company.settings or {}).get("timezone", "UTC"))
    day = start_time.astimezone(tz).date()
    slots = await _candidate_slots(db, tenant_id, service, company, day)
    return start_time in slots


async def _candidate_slots(
    db: AsyncSession, tenant_id: uuid.UUID, service: Service, company: Company, day: date_cls
) -> list[datetime]:
    company_settings = company.settings or {}

    tz = ZoneInfo(company_settings.get("timezone", "UTC"))
    hours = (company_settings.get("business_hours") or {}).get(DOW_KEYS[day.weekday()])
    if not hours:
        return []

    open_dt = datetime.combine(day, time.fromisoformat(hours["open"]), tzinfo=tz)
    close_dt = datetime.combine(day, time.fromisoformat(hours["close"]), tzinfo=tz)
    duration = timedelta(minutes=service.duration_min)

    busy = await repository.list_busy_intervals(db, tenant_id, open_dt, close_dt)

    # Slots are back-to-back by service duration (no separate interval grid
    # or lead-time floor) — a candidate starts every `duration` from open_dt.
    slots = []
    cursor = open_dt
    while cursor + duration <= close_dt:
        slot_end = cursor + duration
        overlaps_busy = any(cursor < b_end and slot_end > b_start for b_start, b_end in busy)
        if not overlaps_busy:
            slots.append(cursor)
        cursor += duration
    return slots
