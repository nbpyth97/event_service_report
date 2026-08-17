import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Company, RefreshToken, User


async def fetch_company_by_slug(db: AsyncSession, tenant_slug: str) -> Company | None:
    stmt = select(Company).where(Company.slug == tenant_slug)
    return (await db.execute(stmt)).scalar_one_or_none()


async def fetch_user_by_name(db: AsyncSession, tenant_id: uuid.UUID, name: str) -> User | None:
    stmt = select(User).where(User.tenant_id == tenant_id, User.name == name)
    return (await db.execute(stmt)).scalar_one_or_none()


async def fetch_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def fetch_refresh_token_by_jti(db: AsyncSession, jti: str) -> RefreshToken | None:
    stmt = select(RefreshToken).where(RefreshToken.jti == jti)
    return (await db.execute(stmt)).scalar_one_or_none()


async def try_insert_company(db: AsyncSession, company: Company) -> bool:
    """Returns False (rolled back) on a duplicate slug instead of raising —
    lets the service layer decide how to turn that into an HTTP error."""
    db.add(company)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return False
    return True


async def insert_user(db: AsyncSession, user: User) -> None:
    db.add(user)
    await db.commit()
    await db.refresh(user)


async def try_insert_user(db: AsyncSession, user: User) -> bool:
    """Returns False (rolled back) on a duplicate (tenant_id, name)."""
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return False
    await db.refresh(user)
    return True


async def insert_refresh_token(db: AsyncSession, token: RefreshToken) -> None:
    db.add(token)
    await db.commit()


async def revoke_refresh_token(db: AsyncSession, token_row: RefreshToken, revoked_at: datetime) -> None:
    token_row.revoked_at = revoked_at
    await db.commit()


async def revoke_all_for_tenant(db: AsyncSession, tenant_id: uuid.UUID, revoked_at: datetime) -> int:
    """CLI-only (see app/scripts/invalidate_tenant_tokens.py) — never called from a router."""
    stmt = (
        update(RefreshToken)
        .where(
            RefreshToken.revoked_at.is_(None),
            RefreshToken.user_id.in_(select(User.id).where(User.tenant_id == tenant_id)),
        )
        .values(revoked_at=revoked_at)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


async def save(db: AsyncSession) -> None:
    await db.commit()
