import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_admin
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.models import User
from app.core.schemas import AvailabilityOut, ServiceCreate, ServiceOut, ServiceUpdate
from app.domains.availability import service as availability_service
from app.domains.services import service as services_service

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=list[ServiceOut])
async def list_services(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await services_service.list_services(
        db, current_user.tenant_id, include_inactive=current_user.role == UserRole.ADMIN.value
    )


@router.get("/{service_id}", response_model=ServiceOut)
async def get_service(
    service_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await services_service.get_service(db, current_user.tenant_id, service_id)


@router.get("/{service_id}/availability", response_model=AvailabilityOut)
async def get_availability(
    service_id: uuid.UUID,
    date: date,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slots = await availability_service.get_available_slots(db, current_user.tenant_id, service_id, date)
    return AvailabilityOut(slots=slots)


@router.post("", response_model=ServiceOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_service(
    payload: ServiceCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await services_service.create_service(db, current_user.tenant_id, current_user.id, payload)


@router.patch("/{service_id}", response_model=ServiceOut, dependencies=[Depends(require_admin)])
async def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await services_service.update_service(db, current_user.tenant_id, service_id, payload)


@router.delete("/{service_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_service(
    service_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await services_service.delete_service(db, current_user.tenant_id, service_id)
