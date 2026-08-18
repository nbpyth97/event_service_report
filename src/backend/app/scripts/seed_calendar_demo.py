"""Re-populate the pilot company's agendamentos with a richer,
presentation-ready set of fake bookings for exercising the week calendar UI —
every status, a handful of intentionally overlapping bookings (to check the
side-by-side column layout), and a spread across a closed day (Mon/Sun), past
days, today, and next week.

Assumes `app/scripts/seed.py` has already created the company, its admin, its
customers (Maria/Joana/Inês) and its services. Only ever touches that
company's own agendamentos + notifications rows — re-runnable at any time.

Usage: uv run python -m app.scripts.seed_calendar_demo
"""

import asyncio
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.core.enums import BookingStatus
from app.core.models import (
    Agendamento,
    AgendamentoStatusHistory,
    Company,
    Customer,
    Notification,
    Service,
    User,
)
from app.domains.agendamentos import repository as agendamentos_repository
from app.domains.agendamentos import service as agendamentos_service
from app.domains.notifications import service as notifications_service
from app.scripts.seed import COMPANY_NAME

TZ = ZoneInfo("Europe/Lisbon")


def local_dt(d: date, hour: int, minute: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=TZ)


async def seed_calendar_demo() -> None:
    async with AsyncSessionLocal() as db:
        company = (
            await db.execute(select(Company).where(Company.name == COMPANY_NAME))
        ).scalar_one_or_none()
        if not company:
            raise SystemExit(f"Company '{COMPANY_NAME}' not found — run `uv run python -m app.scripts.seed` first.")

        admin = (
            await db.execute(select(User).where(User.tenant_id == company.id).order_by(User.created_at))
        ).scalars().first()
        if not admin:
            raise SystemExit("Expected a staff user — run `app/scripts/seed.py` first.")

        customers = (
            await db.execute(select(Customer).where(Customer.tenant_id == company.id))
        ).scalars().all()
        by_name = {c.name: c for c in customers}
        if not {"Maria", "Joana", "Inês"} <= by_name.keys():
            raise SystemExit("Expected customers Maria/Joana/Inês — run `app/scripts/seed.py` first.")
        maria, joana, ines = by_name["Maria"], by_name["Joana"], by_name["Inês"]

        services = (await db.execute(select(Service).where(Service.tenant_id == company.id))).scalars().all()
        by_service = {s.name: s for s in services}
        manicure = by_service["Manicure"]
        pedicure = by_service["Pedicure"]
        depilacao = by_service["Depilação Perna Inteira"]
        sobrancelha = by_service["Sobrancelha"]
        massagem = by_service["Massagem Relaxante"]

        # Wipe this tenant's existing bookings so the script is safe to
        # re-run. Notifications and status history both FK to agendamento_id
        # (no cascade), so they have to go first.
        await db.execute(delete(Notification).where(Notification.tenant_id == company.id))
        await db.execute(delete(AgendamentoStatusHistory).where(AgendamentoStatusHistory.tenant_id == company.id))
        await db.execute(delete(Agendamento).where(Agendamento.tenant_id == company.id))
        await db.commit()

        today = date.today()
        monday = today - timedelta(days=today.weekday())

        def d(week_offset: int, weekday: int) -> date:
            # weekday: 0=Mon .. 6=Sun (matches date.weekday())
            return monday + timedelta(days=week_offset * 7 + weekday)

        # (customer, service, local start time, final status — None stays "pending")
        bookings = [
            # This week — Tue..Sat only (anabela is closed Mon/Sun)
            (maria, manicure, local_dt(d(0, 1), 9, 0), BookingStatus.CONFIRMED),
            (joana, sobrancelha, local_dt(d(0, 1), 9, 15), BookingStatus.CONFIRMED),  # overlaps maria's manicure
            (ines, pedicure, local_dt(d(0, 2), 10, 0), BookingStatus.DECLINED),
            (maria, massagem, local_dt(d(0, 2), 15, 0), BookingStatus.CONFIRMED),
            (joana, depilacao, local_dt(d(0, 3), 11, 0), BookingStatus.CANCELLED),
            (ines, manicure, local_dt(d(0, 3), 16, 30), BookingStatus.CONFIRMED),
            (maria, sobrancelha, local_dt(d(0, 4), 10, 0), BookingStatus.CONFIRMED),
            (joana, pedicure, local_dt(d(0, 4), 14, 0), None),
            (ines, manicure, local_dt(d(0, 4), 14, 15), None),  # overlaps joana's pedicure
            (maria, massagem, local_dt(d(0, 4), 17, 0), None),
            (joana, manicure, local_dt(d(0, 5), 9, 30), BookingStatus.CONFIRMED),
            (maria, sobrancelha, local_dt(d(0, 5), 9, 30), None),  # overlaps joana's manicure
            (ines, depilacao, local_dt(d(0, 5), 12, 0), None),
            # Next week
            (maria, pedicure, local_dt(d(1, 1), 9, 0), None),
            (joana, massagem, local_dt(d(1, 2), 13, 0), BookingStatus.CONFIRMED),
            (ines, sobrancelha, local_dt(d(1, 3), 10, 30), None),
            (maria, manicure, local_dt(d(1, 4), 16, 0), BookingStatus.CONFIRMED),
            (joana, depilacao, local_dt(d(1, 5), 11, 0), None),
        ]

        for customer, service, start_time, final_status in bookings:
            # Bypass agendamentos_service.create_agendamento's overlap guard on
            # purpose here — several of the rows above are deliberately
            # overlapping fixtures for the calendar UI, so we insert directly
            # instead of going through the real booking flow.
            agendamento = Agendamento(
                tenant_id=company.id,
                service_id=service.id,
                customer_id=customer.id,
                created_by=None,
                start_time=start_time,
                end_time=start_time + timedelta(minutes=service.duration_min),
                status=BookingStatus.PENDING.value,
            )
            await agendamentos_repository.insert(db, agendamento)
            agendamento = await agendamentos_service.get_agendamento(db, company.id, agendamento.id)
            await notifications_service.notify_booking_pending(db, company.id, agendamento)
            if final_status:
                await agendamentos_service.update_status(db, admin, agendamento.id, final_status)

        print(
            f"Reseeded {len(bookings)} agendamentos for '{company.slug}' "
            f"(week of {monday} and the following week)."
        )


if __name__ == "__main__":
    asyncio.run(seed_calendar_demo())
