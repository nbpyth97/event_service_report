import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Service
from app.core.schemas import ServiceCreate, ServiceUpdate
from app.services.services import repository


async def list_services(db: AsyncSession, tenant_id: uuid.UUID, include_inactive: bool = False) -> list[Service]:
    return await repository.list_for_tenant(db, tenant_id, include_inactive=include_inactive)


async def get_service(db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID) -> Service:
    service = await repository.fetch_by_id(db, tenant_id, service_id)
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
    await repository.insert(db, service)
    return service


async def update_service(
    db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID, payload: ServiceUpdate
) -> Service:
    service = await get_service(db, tenant_id, service_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    await repository.save(db, service)
    return service


async def delete_service(db: AsyncSession, tenant_id: uuid.UUID, service_id: uuid.UUID) -> None:
    service = await get_service(db, tenant_id, service_id)
    service.active = False
    await repository.save(db, service)
