import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company


async def get_company(db: AsyncSession, tenant_id: uuid.UUID) -> Company:
    company = await db.get(Company, tenant_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company
