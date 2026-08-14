import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Service


async def list_for_tenant(db: AsyncSession, tenant_id: uuid.UUID, include_inactive: bool = False) -> list[Service]:
    stmt = select(Service).where(Service.tenant_id == tenant_id)
    if not include_inactive:
        stmt = stmt.where(Service.active.is_(True))
    stmt = stmt.order_by(Service.name)
    return list((await db.execute(stmt)).scalars().all())


async def fetch_by_id(db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID) -> Service | None:
    stmt = select(Service).where(Service.id == service_id, Service.tenant_id == tenant_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def insert(db: AsyncSession, service: Service) -> None:
    db.add(service)
    await db.commit()
    await db.refresh(service)


async def save(db: AsyncSession, service: Service) -> None:
    await db.commit()
    await db.refresh(service)
