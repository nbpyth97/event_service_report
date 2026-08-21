"""Populate the database with fake data for local development.

Usage: uv run python -m app.scripts.seed
Idempotent — skips seeding if the pilot company already exists (matched by
name, not slug: registration now auto-generates the slug from company_name
— see companies/service.py::slugify — so it's not guaranteed to be exactly
"anabela" anymore, e.g. "Salão Anabela" becomes "salao-anabela").
"""

import asyncio
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.enums import BookingStatus
from app.core.models import Agendamento, Company
from app.core.schemas import RegisterCompanyPayload, ServiceCreate
from app.domains.agendamentos import repository as agendamentos_repository
from app.domains.agendamentos import service as agendamentos_service
from app.domains.auth import service as auth_service
from app.domains.customers import service as customers_service
from app.domains.notifications import service as notifications_service
from app.domains.services import service as services_service

DOW_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")  # date.weekday(): 0=Mon..6=Sun


def _nth_open_day(business_hours: dict, base: date, offset_days: int) -> date:
    """`base` plus `offset_days` *open* business days (closed days like the
    default Mon/Sun don't count towards the offset), walking forward for a
    positive offset or backward for a negative one — so seeded bookings
    always land on a day the tenant is actually open, regardless of what
    "today" happens to be when this script runs."""
    step = 1 if offset_days > 0 else -1
    remaining = abs(offset_days)
    day = base
    while remaining > 0:
        day += timedelta(days=step)
        if business_hours.get(DOW_KEYS[day.weekday()]):
            remaining -= 1
    return day


def _local_dt(tz: ZoneInfo, day: date, hour: int, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)


SERVICES = [
    ("Manicure", "25.00", 30),
    ("Pedicure", "30.00", 45),
    ("Depilação Perna Inteira", "45.00", 60),
    ("Sobrancelha", "10.00", 15),
    ("Massagem Relaxante", "60.00", 60),
]

CUSTOMERS = [("Maria", "+351911111001"), ("Joana", "+351911111002"), ("Inês", "+351911111003")]

COMPANY_NAME = "Salão Anabela"
DEFAULT_PASSWORD = "changeme123"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Company).where(Company.name == COMPANY_NAME))).scalar_one_or_none()
        if existing:
            print(f"Seed data already present ('{COMPANY_NAME}', slug '{existing.slug}') — skipping.")
            return

        admin, company = await auth_service.register_company_and_admin(
            db,
            RegisterCompanyPayload(
                company_name=COMPANY_NAME,
                admin_name="admin",
                password=DEFAULT_PASSWORD,
            ),
        )
        print(f"Created company '{COMPANY_NAME}' (slug: {company.slug}) with admin user (password: {DEFAULT_PASSWORD})")

        customers = []
        for name, phone in CUSTOMERS:
            customer = await customers_service.find_or_create_customer(db, admin.tenant_id, name, phone)
            customers.append(customer)
        print(f"Created {len(customers)} customers")

        services = []
        for name, price, duration_min in SERVICES:
            service = await services_service.create_service(
                db, admin.tenant_id, admin.id, ServiceCreate(name=name, price=price, duration_min=duration_min)
            )
            services.append(service)
        print(f"Created {len(services)} services")

        tz = ZoneInfo((company.settings or {}).get("timezone", "UTC"))
        business_hours = (company.settings or {}).get("business_hours") or {}
        today = datetime.now(tz).date()

        # Local business-hours times on guaranteed-open days, not raw UTC
        # now±offset — the old version picked arbitrary UTC instants that,
        # once converted to the tenant's local timezone, almost always fell
        # outside business_hours (or even rolled onto the next calendar day),
        # so these seeded bookings never actually blocked any availability
        # slot. Two are still in the past, to simulate booking history.
        bookings = [
            (customers[0], services[0], _local_dt(tz, _nth_open_day(business_hours, today, 1), 10, 0), None),
            (customers[0], services[2], _local_dt(tz, _nth_open_day(business_hours, today, 3), 14, 0), BookingStatus.CONFIRMED),
            (customers[1], services[1], _local_dt(tz, _nth_open_day(business_hours, today, 2), 11, 0), None),
            (customers[1], services[4], _local_dt(tz, _nth_open_day(business_hours, today, -5), 15, 0), BookingStatus.CONFIRMED),
            (customers[2], services[3], _local_dt(tz, _nth_open_day(business_hours, today, 1), 16, 0), BookingStatus.DECLINED),
            (customers[2], services[0], _local_dt(tz, _nth_open_day(business_hours, today, -2), 9, 0), BookingStatus.CONFIRMED),
        ]
        for customer, service, start_time, final_status in bookings:
            # These fixture times are fixed local-time slots on open days
            # (two are in the past, to simulate booking history) rather than
            # slots resolved through the real picker, so insert directly
            # instead of going through create_agendamento's business-hours/
            # grid guard (see agendamentos/service.py).
            agendamento = Agendamento(
                tenant_id=admin.tenant_id,
                service_id=service.id,
                customer_id=customer.id,
                created_by=None,
                start_time=start_time,
                end_time=start_time + timedelta(minutes=service.duration_min),
                status=BookingStatus.PENDING.value,
                customer_name=customer.customer_known_name,
            )
            await agendamentos_repository.insert(db, agendamento)
            agendamento = await agendamentos_service.get_agendamento(db, admin.tenant_id, agendamento.id)
            await notifications_service.notify_booking_pending(db, admin.tenant_id, agendamento)
            if final_status:
                await agendamentos_service.update_status(db, admin, agendamento.id, final_status)
        print(f"Created {len(bookings)} agendamentos")


if __name__ == "__main__":
    asyncio.run(seed())
