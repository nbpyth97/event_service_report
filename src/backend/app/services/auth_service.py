import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, decode_token, hash_password, verify_and_update_password
from app.core.config import settings
from app.core.models import Company, RefreshToken, User
from app.core.schemas import LoginPayload, RegisterCompanyPayload, RegisterCustomerPayload


async def register_company_and_admin(db: AsyncSession, payload: RegisterCompanyPayload) -> User:
    company = Company(slug=payload.company_slug, name=payload.company_name)
    db.add(company)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A company with this slug already exists")

    admin = User(
        tenant_id=company.id,
        name=payload.admin_name,
        password_hash=hash_password(payload.password),
        role="admin",
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    return admin


async def _get_company_by_slug(db: AsyncSession, tenant_slug: str) -> Company:
    stmt = select(Company).where(Company.slug == tenant_slug)
    company = (await db.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def register_customer(db: AsyncSession, tenant_slug: str, payload: RegisterCustomerPayload) -> User:
    company = await _get_company_by_slug(db, tenant_slug)

    user = User(
        tenant_id=company.id,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A user with this name already exists in this company")
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, payload: LoginPayload) -> User:
    company = await _get_company_by_slug(db, payload.tenant_slug)

    stmt = select(User).where(User.tenant_id == company.id, User.name == payload.name)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid name or password")

    valid, new_hash = verify_and_update_password(payload.password, user.password_hash)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid name or password")
    if new_hash:
        user.password_hash = new_hash
        await db.commit()

    return user


async def issue_tokens(db: AsyncSession, user: User) -> tuple[str, str]:
    jti = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.refresh_token_expire_minutes)
    db.add(RefreshToken(user_id=user.id, jti=jti, expires_at=expires_at))
    await db.commit()

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, jti)
    return access_token, refresh_token


async def rotate_refresh_token(db: AsyncSession, refresh_token: str) -> tuple[str, str]:
    payload = decode_token(refresh_token, "refresh")
    user_id = uuid.UUID(payload["sub"])
    jti = payload["jti"]

    stmt = select(RefreshToken).where(RefreshToken.jti == jti)
    token_row = (await db.execute(stmt)).scalar_one_or_none()
    if not token_row or token_row.revoked_at is not None or token_row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_row.revoked_at = datetime.now(timezone.utc)
    await db.commit()

    return await issue_tokens(db, user)


async def revoke_refresh_token(db: AsyncSession, refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token, "refresh")
    except HTTPException:
        return
    stmt = select(RefreshToken).where(RefreshToken.jti == payload["jti"])
    token_row = (await db.execute(stmt)).scalar_one_or_none()
    if token_row and token_row.revoked_at is None:
        token_row.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def revoke_all_tokens_for_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    """CLI-only (see app/scripts/invalidate_tenant_tokens.py) — never called from a router."""
    stmt = (
        update(RefreshToken)
        .where(
            RefreshToken.revoked_at.is_(None),
            RefreshToken.user_id.in_(select(User.id).where(User.tenant_id == tenant_id)),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount
