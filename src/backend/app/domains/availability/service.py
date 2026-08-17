import uuid
from datetime import date as date_cls
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

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
    company_settings = company.settings or {}

    tz = ZoneInfo(company_settings.get("timezone", "UTC"))
    hours = (company_settings.get("business_hours") or {}).get(DOW_KEYS[day.weekday()])
    if not hours:
        return []

    interval_min = company_settings.get("slot_interval_min", 15)
    lead_time_min = company_settings.get("min_lead_time_min", 0)

    open_dt = datetime.combine(day, time.fromisoformat(hours["open"]), tzinfo=tz)
    close_dt = datetime.combine(day, time.fromisoformat(hours["close"]), tzinfo=tz)
    duration = timedelta(minutes=service.duration_min)
    earliest_allowed = datetime.now(timezone.utc) + timedelta(minutes=lead_time_min)

    busy = await repository.list_busy_intervals(db, tenant_id, open_dt, close_dt)

    slots = []
    cursor = open_dt
    while cursor + duration <= close_dt:
        slot_end = cursor + duration
        overlaps_busy = any(cursor < b_end and slot_end > b_start for b_start, b_end in busy)
        if cursor >= earliest_allowed and not overlaps_busy:
            slots.append(cursor)
        cursor += timedelta(minutes=interval_min)
    return slots
