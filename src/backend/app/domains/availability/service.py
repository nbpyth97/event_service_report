import uuid
from datetime import date as date_cls
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company, Service
from app.domains.availability import repository
from app.domains.companies import repository as companies_repository
from app.domains.services.service import get_service

DOW_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")  # date.weekday(): 0=Mon..6=Sun

# Fallback when a company's settings predate slot_interval_min or carry a
# junk value — same number DEFAULT_COMPANY_SETTINGS seeds new companies with.
DEFAULT_SLOT_INTERVAL_MIN = 15


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
    slot-grid, already-started and tenant-wide busy-overlap rules, applied to
    one specific start_time rather than enumerated over a whole day. A slot the
    picker never offered can never be booked either, and vice versa."""
    company = await companies_repository.fetch_by_id(db, tenant_id)
    tz = ZoneInfo((company.settings or {}).get("timezone", "UTC"))
    day = start_time.astimezone(tz).date()
    slots = await _candidate_slots(db, tenant_id, service, company, day)
    return start_time in slots


def _slot_interval(company_settings: dict) -> timedelta:
    raw = company_settings.get("slot_interval_min")
    minutes = raw if isinstance(raw, int) and raw > 0 else DEFAULT_SLOT_INTERVAL_MIN
    return timedelta(minutes=minutes)


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
    step = _slot_interval(company_settings)

    busy = await repository.list_busy_intervals(db, tenant_id, open_dt, close_dt)
    now = datetime.now(timezone.utc)

    # Two independent knobs, and conflating them was the old bug: the cursor
    # advances by `step` (slot_interval_min) so candidates land on a tidy
    # :00/:15/:30/:45 grid, while `duration` only decides how much free time a
    # candidate needs. Stepping by `duration` instead anchored every candidate
    # to open_dt, so a booking that ended off-grid (say 08:30, with a 45-min
    # service) left the free window after it unreachable — not busy, just
    # never generated. A slot must still fit whole inside business hours.
    slots = []
    cursor = open_dt
    while cursor + duration <= close_dt:
        slot_end = cursor + duration
        # Nothing already under way: without this, today's picker still offers
        # 08:00 at 18:00 and the write path happily accepts it. Deliberately a
        # flat "not in the past" and not the old configurable min_lead_time_min,
        # which silently swallowed the next 30 minutes of a walk-in salon's day.
        if cursor >= now and not any(cursor < b_end and slot_end > b_start for b_start, b_end in busy):
            slots.append(cursor)
        cursor += step
    return slots
