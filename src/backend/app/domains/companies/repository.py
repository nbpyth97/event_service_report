import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company


async def fetch_by_id(db: AsyncSession, tenant_id: uuid.UUID) -> Company | None:
    return await db.get(Company, tenant_id)


async def fetch_by_slug(db: AsyncSession, slug: str) -> Company | None:
    stmt = select(Company).where(Company.slug == slug)
    return (await db.execute(stmt)).scalar_one_or_none()
