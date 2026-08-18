import re
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Customer
from app.domains.customers import repository


def normalize_phone(raw: str) -> str:
    """Digits only, keeping a leading '+' if the caller included a country
    code — this is the business identity (see uq_customers_tenant_id_phone),
    so two spellings of the same number ("+351 912 345 678" vs "912345678")
    must normalize to the same key."""
    raw = raw.strip()
    digits = re.sub(r"\D", "", raw)
    return f"+{digits}" if raw.startswith("+") else digits


async def find_or_create_customer(db: AsyncSession, tenant_id: uuid.UUID, name: str, phone: str) -> Customer:
    return await repository.upsert_by_phone(db, tenant_id, normalize_phone(phone), name.strip())


async def list_customers(db: AsyncSession, tenant_id: uuid.UUID) -> list[Customer]:
    return await repository.list_for_tenant(db, tenant_id)


async def get_customer(db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Customer:
    customer = await repository.fetch_by_id(db, tenant_id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer


async def set_alias(db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID, alias: str | None) -> Customer:
    customer = await get_customer(db, tenant_id, customer_id)
    customer.alias = alias.strip() if alias and alias.strip() else None
    await repository.save(db, customer)
    return customer
