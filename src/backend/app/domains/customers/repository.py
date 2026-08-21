import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Customer


async def fetch_by_id(db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Customer | None:
    stmt = select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_for_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Customer]:
    stmt = select(Customer).where(Customer.tenant_id == tenant_id).order_by(Customer.customer_known_name)
    return list((await db.execute(stmt)).scalars().all())


async def upsert_by_phone(db: AsyncSession, tenant_id: uuid.UUID, phone: str, name: str) -> Customer:
    """Atomic find-or-create keyed on (tenant_id, phone) — the name is only
    ever written on first insert. Uses INSERT ... ON CONFLICT DO NOTHING
    rather than select-then-insert so two near-simultaneous bookings from a
    phone number seen for the first time can't race into duplicate Customer
    rows; on conflict we fall back to a plain SELECT since DO NOTHING returns
    no row."""
    stmt = (
        pg_insert(Customer)
        .values(tenant_id=tenant_id, phone=phone, customer_known_name=name)
        .on_conflict_do_nothing(constraint="uq_customers_tenant_id_phone")
        .returning(Customer)
    )
    result = await db.execute(stmt)
    customer = result.scalar_one_or_none()
    if customer is None:
        stmt = select(Customer).where(Customer.tenant_id == tenant_id, Customer.phone == phone)
        customer = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return customer


async def update(
    db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID, name: str, phone: str | None
) -> Customer | None:
    """phone=None leaves the stored phone alone (see schemas.py::CustomerUpdate)
    — the caller is responsible for catching the IntegrityError a colliding
    phone raises on commit (uq_customers_tenant_id_phone)."""
    customer = await fetch_by_id(db, tenant_id, customer_id)
    if customer is None:
        return None
    customer.customer_known_name = name
    if phone is not None:
        customer.phone = phone
    await db.commit()
    await db.refresh(customer)
    return customer
