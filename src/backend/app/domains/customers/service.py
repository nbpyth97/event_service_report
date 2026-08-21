import re
import uuid

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Customer
from app.domains.customers import repository


def normalize_phone(raw: str) -> str:
    """Digits only, no '+' — it's noise, not help. This is the business
    identity (see uq_customers_tenant_id_phone), so there must be exactly one
    way to spell a given number; schemas.py's _validate_phone_digits already
    requires the caller to type the full 351<9-digit mobile> number (exactly
    12 digits, both sides of every endpoint), so a bare digit-strip is enough
    to land on one canonical form. A version that instead tried to guess
    whether to keep or add '+'/the country code let "+351929349996" and
    "351929349996" normalize to two different strings and silently split one
    customer into two rows with two independent booking histories."""
    return re.sub(r"\D", "", raw.strip())


async def find_or_create_customer(db: AsyncSession, tenant_id: uuid.UUID, name: str, phone: str) -> Customer:
    return await repository.upsert_by_phone(db, tenant_id, normalize_phone(phone), name.strip())


async def list_customers(db: AsyncSession, tenant_id: uuid.UUID) -> list[Customer]:
    return await repository.list_for_tenant(db, tenant_id)


async def get_customer(db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Customer:
    customer = await repository.fetch_by_id(db, tenant_id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer


async def update_customer(
    db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID, name: str, phone: str | None = None
) -> Customer:
    normalized_phone = normalize_phone(phone) if phone is not None else None
    try:
        customer = await repository.update(db, tenant_id, customer_id, name.strip(), normalized_phone)
    except IntegrityError as exc:
        await db.rollback()  # the failed commit leaves the session unusable otherwise
        raise HTTPException(status_code=409, detail="Já existe um cliente com este número de telemóvel") from exc
    if customer is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer
