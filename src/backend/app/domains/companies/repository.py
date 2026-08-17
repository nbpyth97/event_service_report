import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company


async def fetch_by_id(db: AsyncSession, tenant_id: uuid.UUID) -> Company | None:
    return await db.get(Company, tenant_id)
