"""Populate the database with fake data for local development.

Usage: uv run python -m app.scripts.seed
Idempotent — skips seeding if the pilot company already exists (matched by
name, not slug: registration now auto-generates the slug from company_name
— see companies/service.py::slugify — so it's not guaranteed to be exactly
"anabela" anymore, e.g. "Salão Anabela" becomes "salao-anabela").
"""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.enums import BookingStatus
from app.core.models import Agendamento, Company
from app.core.schemas import RegisterCompanyPayload, RegisterCustomerPayload, ServiceCreate, AgendamentoCreate
from app.domains.agendamentos import repository as agendamentos_repository
from app.domains.agendamentos import service as agendamentos_service
from app.domains.auth import service as auth_service
from app.domains.notifications import service as notifications_service
from app.domains.services import service as services_service

SERVICES = [
    ("Manicure", "25.00", 30),
    ("Pedicure", "30.00", 45),
    ("Depilação Perna Inteira", "45.00", 60),
    ("Sobrancelha", "10.00", 15),
    ("Massagem Relaxante", "60.00", 60),
]

CUSTOMERS = ["maria", "joana", "ines"]

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
        for name in CUSTOMERS:
            customer = await auth_service.register_customer(
                db, company.slug, RegisterCustomerPayload(name=name, password=DEFAULT_PASSWORD)
            )
            customers.append(customer)
        print(f"Created {len(customers)} customer users (password: {DEFAULT_PASSWORD})")

        services = []
        for name, price, duration_min in SERVICES:
            service = await services_service.create_service(
                db, admin.tenant_id, admin.id, ServiceCreate(name=name, price=price, duration_min=duration_min)
            )
            services.append(service)
        print(f"Created {len(services)} services")

        now = datetime.now(timezone.utc)
        bookings = [
            (customers[0], services[0], now + timedelta(days=1, hours=2), None),
            (customers[0], services[2], now + timedelta(days=3), BookingStatus.CONFIRMED),
            (customers[1], services[1], now + timedelta(days=2, hours=5), None),
            (customers[1], services[4], now - timedelta(days=5), BookingStatus.CONFIRMED),
            (customers[2], services[3], now + timedelta(days=1, hours=6), BookingStatus.DECLINED),
            (customers[2], services[0], now - timedelta(days=2), BookingStatus.CONFIRMED),
        ]
        for customer, service, start_time, final_status in bookings:
            # These fixture times are arbitrary now±offset (two are even in
            # the past, to simulate booking history) rather than real slots a
            # customer could pick, so insert directly instead of going
            # through create_agendamento's business-hours/grid/lead-time
            # guard (see agendamentos/service.py).
            agendamento = Agendamento(
                tenant_id=admin.tenant_id,
                service_id=service.id,
                created_by=customer.id,
                start_time=start_time,
                end_time=start_time + timedelta(minutes=service.duration_min),
                status=BookingStatus.PENDING.value,
            )
            await agendamentos_repository.insert(db, agendamento)
            agendamento = await agendamentos_service.get_agendamento(db, admin.tenant_id, agendamento.id)
            await notifications_service.notify_booking_pending(db, admin.tenant_id, agendamento)
            if final_status:
                await agendamentos_service.update_status(db, admin, agendamento.id, final_status)
        print(f"Created {len(bookings)} agendamentos")


if __name__ == "__main__":
    asyncio.run(seed())
