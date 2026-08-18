from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import User
from app.core.schemas import CompanyOut, CompanyUpdate
from app.domains.companies import service as companies_service

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/me", response_model=CompanyOut)
async def get_my_company(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await companies_service.get_company(db, current_user.tenant_id)


@router.patch("/me", response_model=CompanyOut)
async def update_my_company(
    payload: CompanyUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Company settings, staff-only. There are no roles, so every account that
    can reach this endpoint is an administrator of its own tenant — and
    tenant_id comes from the JWT, never the body, so a company can only ever
    patch itself."""
    return await companies_service.update_company(db, current_user.tenant_id, payload)
