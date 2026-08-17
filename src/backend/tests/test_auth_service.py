import pytest
from fastapi import HTTPException

from app.core.auth import create_access_token
from app.core.database import AsyncSessionLocal
from app.core.schemas import RegisterCompanyPayload, RegisterCustomerPayload
from app.domains.auth.service import (
    register_company_and_admin,
    register_customer,
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
        admin = await register_company_and_admin(
            db,
            RegisterCompanyPayload(
                company_name="Acme", company_slug=unique_slug, admin_name="admin", password="supersecret1"
            ),
        )
        await db.commit()
        # an access token is a structurally valid JWT, just the wrong "type"
        access_token = create_access_token(admin.id)
        with pytest.raises(HTTPException) as exc_info:
            await rotate_refresh_token(db, access_token)
    assert exc_info.value.status_code == 401


async def test_register_customer_duplicate_name_in_same_tenant_conflicts(unique_slug):
    async with AsyncSessionLocal() as db:
        await register_company_and_admin(
            db,
            RegisterCompanyPayload(
                company_name="Acme", company_slug=unique_slug, admin_name="admin", password="supersecret1"
            ),
        )
        await db.commit()

    async with AsyncSessionLocal() as db:
        await register_customer(db, unique_slug, RegisterCustomerPayload(name="cliente", password="supersecret1"))
        await db.commit()

    async with AsyncSessionLocal() as db:
        with pytest.raises(HTTPException) as exc_info:
            await register_customer(db, unique_slug, RegisterCustomerPayload(name="cliente", password="supersecret1"))
    assert exc_info.value.status_code == 409


async def test_register_customer_unknown_tenant_raises_404():
    async with AsyncSessionLocal() as db:
        with pytest.raises(HTTPException) as exc_info:
            await register_customer(db, "does-not-exist", RegisterCustomerPayload(name="x", password="supersecret1"))
    assert exc_info.value.status_code == 404
