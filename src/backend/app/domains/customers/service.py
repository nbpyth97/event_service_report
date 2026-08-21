import uuid

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Customer
from app.core.phone import DEFAULT_REGION, to_e164
from app.domains.customers import repository


def normalize_phone(raw: str, country: str) -> str:
    """Turn a customer-typed (phone, country) pair into the canonical E.164
    value this domain treats as its business key (uq_customers_tenant_id_phone)
    — the single place that decision is made, so there's exactly one spelling
    of a given number regardless of whether it arrived from staff (customers
    router) or an anonymous customer (public router). Deliberately not in
    core/schemas.py: which numbering plan applies, whether an explicit "+"
    overrides the selected country, and what counts as a valid number are
    business rules (see core/phone.py::to_e164), not wire-format concerns."""
    try:
        return to_e164(raw, country)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def find_or_create_customer(
    db: AsyncSession, tenant_id: uuid.UUID, name: str, phone: str, country: str
) -> Customer:
    return await repository.upsert_by_phone(db, tenant_id, normalize_phone(phone, country), name.strip())


async def list_customers(db: AsyncSession, tenant_id: uuid.UUID) -> list[Customer]:
    return await repository.list_for_tenant(db, tenant_id)


async def get_customer(db: AsyncSession, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Customer:
    customer = await repository.fetch_by_id(db, tenant_id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer


async def update_customer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    customer_id: uuid.UUID,
    name: str,
    phone: str | None = None,
    country: str = DEFAULT_REGION,
) -> Customer:
    normalized_phone = normalize_phone(phone, country) if phone is not None else None
    try:
        customer = await repository.update(db, tenant_id, customer_id, name.strip(), normalized_phone)
    except IntegrityError as exc:
        await db.rollback()  # the failed commit leaves the session unusable otherwise
        raise HTTPException(status_code=409, detail="Já existe um cliente com este número de telemóvel") from exc
    if customer is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer
