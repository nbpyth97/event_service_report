"""Populate the database with fake data for local development.

Usage: uv run python -m app.scripts.seed
Idempotent — skips seeding if the "anabela" company already exists.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.enums import BookingStatus
from app.core.models import Company
from app.core.schemas import RegisterCompanyPayload, RegisterCustomerPayload, ServiceCreate, AgendamentoCreate
from app.services.agendamentos import service as agendamentos_service
from app.services.auth import service as auth_service
from app.services.services import service as services_service

SERVICES = [
    ("Manicure", "25.00", 30),
    ("Pedicure", "30.00", 45),
    ("Depilação Perna Inteira", "45.00", 60),
    ("Sobrancelha", "10.00", 15),
    ("Massagem Relaxante", "60.00", 60),
]

CUSTOMERS = ["maria", "joana", "ines"]

DEFAULT_PASSWORD = "changeme123"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Company).where(Company.slug == "anabela"))).scalar_one_or_none()
        if existing:
            print("Seed data already present (company 'anabela' exists) — skipping.")
            return

        admin = await auth_service.register_company_and_admin(
            db,
            RegisterCompanyPayload(
                company_name="Salão Anabela",
                company_slug="anabela",
                admin_name="admin",
                password=DEFAULT_PASSWORD,
            ),
        )
        print(f"Created company 'anabela' with admin user (password: {DEFAULT_PASSWORD})")

        customers = []
        for name in CUSTOMERS:
            customer = await auth_service.register_customer(
                db, "anabela", RegisterCustomerPayload(name=name, password=DEFAULT_PASSWORD)
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
            agendamento = await agendamentos_service.create_agendamento(
                db, admin.tenant_id, customer.id, AgendamentoCreate(service_id=service.id, start_time=start_time)
            )
            if final_status:
                await agendamentos_service.update_status(db, admin, agendamento.id, final_status)
        print(f"Created {len(bookings)} agendamentos")


if __name__ == "__main__":
    asyncio.run(seed())
