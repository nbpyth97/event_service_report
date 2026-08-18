import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import AgendamentoOut, AvailabilityOut, PublicBookingCreate, PublicCompanyOut, ServiceOut
from app.domains.agendamentos import service as agendamentos_service
from app.domains.availability import service as availability_service
from app.domains.companies import service as companies_service
from app.domains.customers import service as customers_service
from app.domains.services import service as services_service

# Unauthenticated — the only booking path available to a customer who has no
# account (see CLAUDE.md's Customer != User note). Every route resolves the
# tenant by slug itself; no dependency on get_current_user anywhere here.
router = APIRouter(prefix="/api/public/{tenant_slug}", tags=["public"])


@router.get("/company", response_model=PublicCompanyOut)
async def get_public_company(tenant_slug: str, db: AsyncSession = Depends(get_db)):
    company = await companies_service.get_company_by_slug(db, tenant_slug)
    settings = company.settings or {}
    return PublicCompanyOut(
        name=company.name,
        business_hours=settings.get("business_hours", {}),
        timezone=settings.get("timezone", "UTC"),
    )


@router.get("/services", response_model=list[ServiceOut])
async def list_public_services(tenant_slug: str, db: AsyncSession = Depends(get_db)):
    company = await companies_service.get_company_by_slug(db, tenant_slug)
    return await services_service.list_services(db, company.id, include_inactive=False)


@router.get("/services/{service_id}/availability", response_model=AvailabilityOut)
async def get_public_availability(
    tenant_slug: str, service_id: uuid.UUID, date: date, db: AsyncSession = Depends(get_db)
):
    company = await companies_service.get_company_by_slug(db, tenant_slug)
    slots = await availability_service.get_available_slots(db, company.id, service_id, date)
    return AvailabilityOut(slots=slots)


@router.post("/book", response_model=AgendamentoOut, status_code=201)
async def create_public_booking(tenant_slug: str, payload: PublicBookingCreate, db: AsyncSession = Depends(get_db)):
    company = await companies_service.get_company_by_slug(db, tenant_slug)
    customer = await customers_service.find_or_create_customer(db, company.id, payload.name, payload.phone)
    return await agendamentos_service.create_agendamento(
        db, company.id, customer.id, payload.service_id, payload.start_time, created_by=None
    )
