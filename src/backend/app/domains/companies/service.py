import re
import unicodedata
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company
from app.domains.companies import repository


async def get_company(db: AsyncSession, tenant_id: uuid.UUID) -> Company:
    company = await repository.fetch_by_id(db, tenant_id)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return company


async def get_company_by_slug(db: AsyncSession, slug: str) -> Company:
    company = await repository.fetch_by_slug(db, slug)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return company


def slugify(name: str) -> str:
    """Company registration no longer asks the admin to pick a slug — this
    derives one from the company name (auth/service.py::register_company_and_admin
    retries with a numeric suffix on collision)."""
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "empresa"
