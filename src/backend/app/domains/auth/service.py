import copy
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, decode_token, hash_password, verify_and_update_password
from app.core.config import settings
from app.core.models import DEFAULT_COMPANY_SETTINGS, Company, RefreshToken, User
from app.core.schemas import LoginPayload, RegisterCompanyPayload
from app.domains.auth import repository
from app.domains.companies.service import slugify

MAX_SLUG_ATTEMPTS = 50


async def register_company_and_admin(db: AsyncSession, payload: RegisterCompanyPayload) -> tuple[User, Company]:
    """Returns (admin, company) — the caller needs company.slug to hand back
    to the client, since nothing else lets an admin discover the
    auto-generated slug they'll need for future logins (see
    routers/auth.py::RegisterCompanyOut)."""
    base_slug = slugify(payload.company_name)
    company: Company | None = None
    for attempt in range(1, MAX_SLUG_ATTEMPTS + 1):
        slug = base_slug if attempt == 1 else f"{base_slug}-{attempt}"
        candidate = Company(slug=slug, name=payload.company_name, settings=copy.deepcopy(DEFAULT_COMPANY_SETTINGS))
        if await repository.try_insert_company(db, candidate):
            company = candidate
            break
    if company is None:
        raise HTTPException(status_code=409, detail="Não foi possível gerar um identificador único para a empresa")

    admin = User(
        tenant_id=company.id,
        name=payload.admin_name,
        password_hash=hash_password(payload.password),
    )
    await repository.insert_user(db, admin)
    return admin, company


async def _get_company_by_slug(db: AsyncSession, tenant_slug: str) -> Company:
    company = await repository.fetch_company_by_slug(db, tenant_slug)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return company


async def authenticate(db: AsyncSession, payload: LoginPayload) -> User:
    company = await _get_company_by_slug(db, payload.tenant_slug)

    user = await repository.fetch_user_by_name(db, company.id, payload.name)
    if not user:
        raise HTTPException(status_code=401, detail="Nome ou senha inválidos")

    valid, new_hash = verify_and_update_password(payload.password, user.password_hash)
    if not valid:
        raise HTTPException(status_code=401, detail="Nome ou senha inválidos")
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
        raise HTTPException(status_code=401, detail="Não autenticado")

    user = await repository.fetch_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

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
