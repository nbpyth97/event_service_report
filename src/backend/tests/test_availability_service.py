import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.models import Agendamento, Company
from app.domains.availability.service import get_available_slots

# Default company settings (app/core/models.py DEFAULT_COMPANY_SETTINGS):
# mon/sun closed, tue-sat 08:00-19:00, 15-min interval, 30-min lead time.
CLOSED_DAY = date(2026, 8, 31)  # Monday
OPEN_DAY = date(2026, 9, 1)  # Tuesday


async def _register_company(client, slug: str):
    res = await client.post(
        "/api/auth/register-company",
        json={"company_name": "Acme", "company_slug": slug, "admin_name": "admin", "password": "supersecret1"},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _register_customer(client, slug: str, name: str = "cliente"):
    res = await client.post(f"/api/auth/{slug}/register", json={"name": name, "password": "supersecret1"})
    assert res.status_code == 201, res.text
    return res.json()


async def _login(client, slug: str, name: str, password: str = "supersecret1"):
    res = await client.post("/api/auth/login", json={"tenant_slug": slug, "name": name, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"], res.json()["user"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _create_service(client, admin_token: str, duration_min: int = 30) -> dict:
    res = await client.post(
        "/api/services",
        json={"name": "Corte", "price": "50.00", "duration_min": duration_min},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _book(client, customer_token: str, service_id: str, start_time: str, status: str | None = None) -> dict:
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service_id, "start_time": start_time},
        headers=_auth_headers(customer_token),
    )
    assert res.status_code == 201, res.text
    agendamento = res.json()
    if status:
        async with AsyncSessionLocal() as db:
            row = await db.get(Agendamento, uuid.UUID(agendamento["id"]))
            row.status = status
            await db.commit()
    return agendamento


async def _set_lead_time_min(tenant_id: str, minutes: int) -> None:
    async with AsyncSessionLocal() as db:
        company = (await db.execute(select(Company).where(Company.id == uuid.UUID(tenant_id)))).scalar_one()
        company.settings = {**company.settings, "min_lead_time_min": minutes}
        await db.commit()


async def test_closed_day_returns_no_slots(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    service = await _create_service(client, admin_token)

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), CLOSED_DAY)
    assert slots == []


async def test_open_day_slots_span_business_hours_at_interval(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    service = await _create_service(client, admin_token, duration_min=30)

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    # 08:00-19:00 local, 15-min interval, 30-min service duration:
    # last bookable start is 18:30 -> (11h*60 - 30) / 15 + 1 = 43 slots.
    assert len(slots) == 43
    assert slots[0].strftime("%H:%M") == "08:00"
    assert slots[-1].strftime("%H:%M") == "18:30"
    # slots are evenly spaced at the configured interval
    assert all((b - a) == timedelta(minutes=15) for a, b in zip(slots, slots[1:]))


async def test_pending_and_confirmed_bookings_block_overlapping_slots(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token, duration_min=30)

    await _book(client, customer_token, service["id"], "2026-09-01T09:00:00+01:00")  # stays pending

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    booked_times = {"08:45", "09:00"}
    assert not any(s.strftime("%H:%M") in booked_times for s in slots)
    # neighboring slots are untouched
    assert any(s.strftime("%H:%M") == "08:30" for s in slots)
    assert any(s.strftime("%H:%M") == "09:30" for s in slots)


async def test_declined_and_cancelled_bookings_do_not_block_slots(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token, duration_min=30)

    await _book(client, customer_token, service["id"], "2026-09-01T09:00:00+01:00", status="declined")
    await _book(client, customer_token, service["id"], "2026-09-01T10:00:00+01:00", status="cancelled")

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    assert any(s.strftime("%H:%M") == "09:00" for s in slots)
    assert any(s.strftime("%H:%M") == "10:00" for s in slots)


async def test_min_lead_time_excludes_all_slots_when_larger_than_the_day(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    service = await _create_service(client, admin_token)

    # a lead time longer than the gap between now and OPEN_DAY's close pushes
    # earliest_allowed past every candidate slot for that day
    await _set_lead_time_min(company["tenant_id"], 10 * 365 * 24 * 60)

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)
    assert slots == []
