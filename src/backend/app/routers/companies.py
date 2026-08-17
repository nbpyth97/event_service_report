from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import User
from app.core.schemas import CompanyOut
from app.domains.companies import service as companies_service

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/me", response_model=CompanyOut)
async def get_my_company(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await companies_service.get_company(db, current_user.tenant_id)
