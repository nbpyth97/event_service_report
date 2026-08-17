import uuid

from app.core.database import AsyncSessionLocal
from app.domains.auth.service import revoke_all_tokens_for_tenant


async def _register_company(client, slug: str):
    res = await client.post(
        "/api/auth/register-company",
        json={"company_name": "Acme", "company_slug": slug, "admin_name": "admin", "password": "supersecret1"},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _register_customer(client, slug: str, name: str = "cliente"):
    res = await client.post(f"/api/auth/{slug}/register", json={"name": name, "password": "supersecret1"})
    assert res.status_code == 201, res.text
    return res.json()


async def _login(client, slug: str, name: str, password: str = "supersecret1"):
    res = await client.post("/api/auth/login", json={"tenant_slug": slug, "name": name, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"], res.json()["user"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_register_company_duplicate_slug_conflicts(client, unique_slug):
    await _register_company(client, unique_slug)
    res = await client.post(
        "/api/auth/register-company",
        json={"company_name": "Acme 2", "company_slug": unique_slug, "admin_name": "admin2", "password": "supersecret1"},
    )
    assert res.status_code == 409


async def test_register_customer_unknown_tenant_404(client):
    res = await client.post("/api/auth/does-not-exist/register", json={"name": "x", "password": "supersecret1"})
    assert res.status_code == 404


async def test_login_wrong_password_401(client, unique_slug):
    await _register_company(client, unique_slug)
    res = await client.post("/api/auth/login", json={"tenant_slug": unique_slug, "name": "admin", "password": "wrong"})
    assert res.status_code == 401


async def test_services_rbac_and_tenant_isolation(client, unique_slug):
    await _register_company(client, unique_slug)
    await _register_customer(client, unique_slug)

    admin_token, _ = await _login(client, unique_slug, "admin")
    customer_token, _ = await _login(client, unique_slug, "cliente")

    # user cannot create services
    res = await client.post(
        "/api/services", json={"name": "Corte", "price": "50.00", "duration_min": 30}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 403

    # admin can
    res = await client.post(
        "/api/services", json={"name": "Corte", "price": "50.00", "duration_min": 30}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    service = res.json()

    # user can read
    res = await client.get("/api/services", headers=_auth_headers(customer_token))
    assert res.status_code == 200
    assert any(s["id"] == service["id"] for s in res.json())

    # a different tenant's admin gets 404, not 403, on this service id (no cross-tenant existence leak)
    other_slug = f"{unique_slug}-other"
    await _register_company(client, other_slug)
    other_admin_token, _ = await _login(client, other_slug, "admin")
    res = await client.get(f"/api/services/{service['id']}", headers=_auth_headers(other_admin_token))
    assert res.status_code == 404

    # customer can book the service
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:00:00Z"},
        headers=_auth_headers(customer_token),
    )
    assert res.status_code == 201, res.text
    agendamento = res.json()
    assert agendamento["status"] == "pending"

    # admin confirms it
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"

    # a second customer in the same tenant doesn't see the first customer's booking
    await _register_customer(client, unique_slug, name="cliente2")
    customer2_token, _ = await _login(client, unique_slug, "cliente2")
    res = await client.get("/api/agendamentos", headers=_auth_headers(customer2_token))
    assert res.status_code == 200
    assert res.json() == []

    # customer cannot confirm/decline bookings (admin-only) — 404, not 403, matching
    # the same "pretend it doesn't exist" convention as get_status_history
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 404


async def test_refresh_and_logout_revokes_token(client, unique_slug):
    await _register_company(client, unique_slug)

    res = await client.post("/api/auth/login", json={"tenant_slug": unique_slug, "name": "admin", "password": "supersecret1"})
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

    res = await client.post("/api/auth/login", json={"tenant_slug": unique_slug, "name": "admin", "password": "supersecret1"})
    assert res.status_code == 200

    async with AsyncSessionLocal() as db:
        count = await revoke_all_tokens_for_tenant(db, uuid.UUID(admin["tenant_id"]))
    assert count == 1

    res = await client.post("/api/auth/refresh")
    assert res.status_code == 401
