import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Service
from app.core.schemas import ServiceCreate, ServiceUpdate


async def list_services(db: AsyncSession, tenant_id: uuid.UUID) -> list[Service]:
    stmt = select(Service).where(Service.tenant_id == tenant_id, Service.active.is_(True)).order_by(Service.name)
    return list((await db.execute(stmt)).scalars().all())


async def get_service(db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID) -> Service:
    stmt = select(Service).where(Service.id == service_id, Service.tenant_id == tenant_id)
    service = (await db.execute(stmt)).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


async def create_service(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, payload: ServiceCreate
) -> Service:
    service = Service(
        tenant_id=tenant_id,
        created_by=created_by,
        name=payload.name,
        price=payload.price,
        duration_min=payload.duration_min,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service


async def update_service(
    db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID, payload: ServiceUpdate
) -> Service:
    service = await get_service(db, tenant_id, service_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    await db.commit()
    await db.refresh(service)
    return service


async def delete_service(db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID) -> None:
    service = await get_service(db, tenant_id, service_id)
    service.active = False
    await db.commit()
