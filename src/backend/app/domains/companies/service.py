import re
import unicodedata
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company
from app.core.schemas import CompanyUpdate
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


async def update_company(db: AsyncSession, tenant_id: uuid.UUID, payload: CompanyUpdate) -> Company:
    """Patch the tenant's own name/settings. `slug` is deliberately absent from
    CompanyUpdate: it is baked into every public booking URL already handed to
    customers, so renaming it would 404 links that are still in circulation."""
    company = await get_company(db, tenant_id)
    data = payload.model_dump(exclude_unset=True)

    if "name" in data:
        company.name = data["name"]

    if "settings" in data:
        # Two things force a whole new dict here rather than an in-place
        # update: `settings` is plain JSONB with no MutableDict tracking, so
        # SQLAlchemy would never see a mutation and would emit no UPDATE at
        # all; and the merge is top-level on purpose, so a business_hours
        # patch replaces all seven days at once (the schema requires all of
        # them) while any settings key this endpoint doesn't know about
        # survives untouched.
        company.settings = {**(company.settings or {}), **data["settings"]}

    await repository.save(db, company)
    return company


def slugify(name: str) -> str:
    """Company registration no longer asks the admin to pick a slug — this
    derives one from the company name (auth/service.py::register_company_and_admin
    retries with a numeric suffix on collision)."""
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "empresa"
