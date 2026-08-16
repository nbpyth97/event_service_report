import copy
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, decode_token, hash_password, verify_and_update_password
from app.core.config import settings
from app.core.enums import UserRole
from app.core.models import DEFAULT_COMPANY_SETTINGS, Company, RefreshToken, User
from app.core.schemas import LoginPayload, RegisterCompanyPayload, RegisterCustomerPayload
from app.services.auth import repository


async def register_company_and_admin(db: AsyncSession, payload: RegisterCompanyPayload) -> User:
    company = Company(
        slug=payload.company_slug,
        name=payload.company_name,
        settings=copy.deepcopy(DEFAULT_COMPANY_SETTINGS),
    )
    if not await repository.try_insert_company(db, company):
        raise HTTPException(status_code=409, detail="A company with this slug already exists")

    admin = User(
        tenant_id=company.id,
        name=payload.admin_name,
        password_hash=hash_password(payload.password),
        role=UserRole.ADMIN.value,
    )
    await repository.insert_user(db, admin)
    return admin


async def _get_company_by_slug(db: AsyncSession, tenant_slug: str) -> Company:
    company = await repository.fetch_company_by_slug(db, tenant_slug)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def register_customer(db: AsyncSession, tenant_slug: str, payload: RegisterCustomerPayload) -> User:
    company = await _get_company_by_slug(db, tenant_slug)

    user = User(
        tenant_id=company.id,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role=UserRole.USER.value,
        phone=payload.phone,
    )
    if not await repository.try_insert_user(db, user):
        raise HTTPException(status_code=409, detail="A user with this name already exists in this company")
    return user


async def authenticate(db: AsyncSession, payload: LoginPayload) -> User:
    company = await _get_company_by_slug(db, payload.tenant_slug)

    user = await repository.fetch_user_by_name(db, company.id, payload.name)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid name or password")

    valid, new_hash = verify_and_update_password(payload.password, user.password_hash)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid name or password")
    if new_hash:
        user.password_hash = new_hash
        await repository.save(db)

    return user


async def issue_tokens(db: AsyncSession, user: User) -> tuple[str, str]:
    jti = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.refresh_token_expire_minutes)
    await repository.insert_refresh_token(db, RefreshToken(user_id=user.id, jti=jti, expires_at=expires_at))

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, jti)
    return access_token, refresh_token


async def rotate_refresh_token(db: AsyncSession, refresh_token: str) -> tuple[str, str]:
    payload = decode_token(refresh_token, "refresh")
    user_id = uuid.UUID(payload["sub"])
    jti = payload["jti"]

    token_row = await repository.fetch_refresh_token_by_jti(db, jti)
    if not token_row or token_row.revoked_at is not None or token_row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = await repository.fetch_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    await repository.revoke_refresh_token(db, token_row, datetime.now(timezone.utc))

    return await issue_tokens(db, user)


async def revoke_refresh_token(db: AsyncSession, refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token, "refresh")
    except HTTPException:
        return
    token_row = await repository.fetch_refresh_token_by_jti(db, payload["jti"])
    if token_row and token_row.revoked_at is None:
        await repository.revoke_refresh_token(db, token_row, datetime.now(timezone.utc))


async def revoke_all_tokens_for_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    """CLI-only (see app/scripts/invalidate_tenant_tokens.py) — never called from a router."""
    return await repository.revoke_all_for_tenant(db, tenant_id, datetime.now(timezone.utc))
