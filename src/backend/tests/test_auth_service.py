import pytest
from fastapi import HTTPException

from app.core.auth import create_access_token
from app.core.database import AsyncSessionLocal
from app.core.schemas import RegisterCompanyPayload
from app.domains.auth.service import (
    register_company_and_admin,
    revoke_refresh_token,
    rotate_refresh_token,
)


async def test_revoke_refresh_token_with_garbage_token_is_a_noop():
    async with AsyncSessionLocal() as db:
        # must not raise — logout is best-effort against whatever cookie is present
        await revoke_refresh_token(db, "not-a-real-jwt")


async def test_rotate_refresh_token_with_garbage_token_raises_401():
    async with AsyncSessionLocal() as db:
        with pytest.raises(HTTPException) as exc_info:
            await rotate_refresh_token(db, "not-a-real-jwt")
    assert exc_info.value.status_code == 401


async def test_rotate_refresh_token_rejects_an_access_token(unique_slug):
    async with AsyncSessionLocal() as db:
        admin, company = await register_company_and_admin(
            db,
            RegisterCompanyPayload(company_name=f"Acme {unique_slug}", admin_name="admin", password="supersecret1"),
        )
        await db.commit()
        # an access token is a structurally valid JWT, just the wrong "type"
        access_token = create_access_token(admin.id)
        with pytest.raises(HTTPException) as exc_info:
            await rotate_refresh_token(db, access_token)
    assert exc_info.value.status_code == 401
