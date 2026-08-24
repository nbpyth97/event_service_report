import uuid

from app.core.auth import hash_password
from app.core.database import AsyncSessionLocal
from app.core.models import User
from app.domains.auth.service import revoke_all_tokens_for_tenant


async def _register_company(client, slug: str):
    res = await client.post(
        "/api/auth/register-company",
        json={"company_name": f"Acme {slug}", "admin_name": "admin", "password": "supersecret1"},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _login(client, slug: str, name: str, password: str = "supersecret1"):
    res = await client.post("/api/auth/login", json={"tenant_slug": slug, "name": name, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"], res.json()["user"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _create_customer(client, admin_token: str, name: str = "Cliente", phone: str = "+351911111111") -> dict:
    res = await client.post(
        "/api/customers", json={"customer_known_name": name, "phone": phone}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _create_raw_staff_user(tenant_id: str, name: str, password: str = "supersecret1") -> None:
    """Registration only ever creates the *first* staff user of a company, so a
    second colleague has to be constructed directly — mirroring
    test_auth_service.py's raw-session style. Used below to prove staff share
    one tenant-wide view of the data."""
    async with AsyncSessionLocal() as db:
        db.add(User(tenant_id=uuid.UUID(tenant_id), name=name, password_hash=hash_password(password)))
        await db.commit()


async def test_register_company_with_duplicate_name_gets_distinct_slug(client, unique_slug):
    # There's no longer a client-supplied slug to collide on — registration
    # auto-derives one from company_name and retries with a numeric suffix on
    # collision (see companies/service.py::slugify), so two companies
    # registered with the same name both succeed with distinct slugs instead
    # of the second one 409ing.
    first = await _register_company(client, unique_slug)
    res = await client.post(
        "/api/auth/register-company",
        json={"company_name": f"Acme {unique_slug}", "admin_name": "admin2", "password": "supersecret1"},
    )
    assert res.status_code == 201, res.text
    second = res.json()
    assert second["tenant_slug"] != first["tenant_slug"]


async def test_login_wrong_password_401(client, unique_slug):
    company = await _register_company(client, unique_slug)
    res = await client.post(
        "/api/auth/login", json={"tenant_slug": company["tenant_slug"], "name": "admin", "password": "wrong"}
    )
    assert res.status_code == 401


async def test_staff_share_tenant_data_and_tenant_isolation(client, unique_slug):
    """There are no roles any more: every User is staff of their company (see
    core/models.py::User), so a second colleague has exactly the same rights as
    the admin who registered — while a *different* tenant still sees nothing."""
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    await _create_raw_staff_user(company["tenant_id"], "colega")

    admin_token, _ = await _login(client, slug, "admin")
    colleague_token, _ = await _login(client, slug, "colega")

    res = await client.post(
        "/api/services", json={"name": "Corte", "price": "50.00", "duration_min": 30}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    service = res.json()

    # a second staff member can create services too
    res = await client.post(
        "/api/services",
        json={"name": "Barba", "price": "20.00", "duration_min": 15},
        headers=_auth_headers(colleague_token),
    )
    assert res.status_code == 201, res.text

    res = await client.get("/api/services", headers=_auth_headers(colleague_token))
    assert res.status_code == 200
    assert any(s["id"] == service["id"] for s in res.json())

    # a different tenant's staff gets 404, not 403, on this service id (no cross-tenant existence leak)
    other_company = await _register_company(client, f"{unique_slug}-other")
    other_token, _ = await _login(client, other_company["tenant_slug"], "admin")
    res = await client.get(f"/api/services/{service['id']}", headers=_auth_headers(other_token))
    assert res.status_code == 404

    # customers have no login of their own — staff book on their behalf
    customer = await _create_customer(client, admin_token)
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:00:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    agendamento = res.json()
    assert agendamento["status"] == "pending"

    # the colleague sees the admin's booking — listing is tenant-wide, no
    # created_by narrowing any more
    res = await client.get("/api/agendamentos", headers=_auth_headers(colleague_token))
    assert res.status_code == 200
    assert [a["id"] for a in res.json()] == [agendamento["id"]]

    # ...and can decide it
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status",
        json={"status": "confirmed"},
        headers=_auth_headers(colleague_token),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"

    # a different tenant still cannot touch it
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status",
        json={"status": "declined"},
        headers=_auth_headers(other_token),
    )
    assert res.status_code == 404


async def test_refresh_and_logout_revokes_token(client, unique_slug):
    company = await _register_company(client, unique_slug)

    res = await client.post(
        "/api/auth/login", json={"tenant_slug": company["tenant_slug"], "name": "admin", "password": "supersecret1"}
    )
    assert res.status_code == 200

    # refresh rotates and returns a new access token
    res = await client.post("/api/auth/refresh")
    assert res.status_code == 200
    assert "access_token" in res.json()

    # logout revokes the (rotated) refresh token
    res = await client.post("/api/auth/logout")
    assert res.status_code == 204

    # a subsequent refresh with the now-revoked cookie fails
    res = await client.post("/api/auth/refresh")
    assert res.status_code == 401


async def test_cli_revoke_all_tokens_for_tenant_forces_relogin(client, unique_slug):
    admin = await _register_company(client, unique_slug)

    res = await client.post(
        "/api/auth/login", json={"tenant_slug": admin["tenant_slug"], "name": "admin", "password": "supersecret1"}
    )
    assert res.status_code == 200

    async with AsyncSessionLocal() as db:
        count = await revoke_all_tokens_for_tenant(db, uuid.UUID(admin["tenant_id"]))
    assert count == 1

    res = await client.post("/api/auth/refresh")
    assert res.status_code == 401
