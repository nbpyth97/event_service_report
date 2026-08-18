import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Customer


async def fetch_by_id(db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Customer | None:
    stmt = select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_for_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Customer]:
    stmt = select(Customer).where(Customer.tenant_id == tenant_id).order_by(Customer.name)
    return list((await db.execute(stmt)).scalars().all())


async def upsert_by_phone(db: AsyncSession, tenant_id: uuid.UUID, phone: str, name: str) -> Customer:
    """Atomic find-or-create keyed on (tenant_id, phone) — most-recent name
    wins on conflict. Uses INSERT ... ON CONFLICT DO UPDATE rather than
    select-then-insert so two near-simultaneous bookings from a phone number
    seen for the first time can't race into duplicate Customer rows."""
    stmt = (
        pg_insert(Customer)
        .values(tenant_id=tenant_id, phone=phone, name=name)
        .on_conflict_do_update(
            constraint="uq_customers_tenant_id_phone",
            set_={"name": name},
        )
        .returning(Customer)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one()


async def save(db: AsyncSession, customer: Customer) -> None:
    await db.commit()
    await db.refresh(customer)
