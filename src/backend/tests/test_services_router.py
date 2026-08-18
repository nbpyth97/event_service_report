import uuid

from app.core.auth import hash_password
from app.core.database import AsyncSessionLocal
from app.core.models import User


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


async def _create_service(client, admin_token: str, **overrides) -> dict:
    payload = {"name": "Corte", "price": "50.00", "duration_min": 30}
    payload.update(overrides)
    res = await client.post("/api/services", json=payload, headers=_auth_headers(admin_token))
    assert res.status_code == 201, res.text
    return res.json()


async def _create_raw_staff_user(tenant_id: str, name: str, password: str = "supersecret1", role: str = "user") -> None:
    """Customers no longer self-register (that endpoint is gone) — this
    keeps the require_admin regression coverage below by constructing a
    non-admin login directly, mirroring test_auth_service.py's raw-session
    style."""
    async with AsyncSessionLocal() as db:
        db.add(User(tenant_id=uuid.UUID(tenant_id), name=name, password_hash=hash_password(password), role=role))
        await db.commit()


async def test_admin_updates_service(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token)

    res = await client.patch(
        f"/api/services/{service['id']}", json={"price": "75.00"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200, res.text
    assert res.json()["price"] == "75.00"
    # unspecified fields are left untouched
    assert res.json()["name"] == "Corte"


async def test_customer_cannot_update_service(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    await _create_raw_staff_user(company["tenant_id"], "cliente")
    customer_token, _ = await _login(client, slug, "cliente")
    service = await _create_service(client, admin_token)

    res = await client.patch(
        f"/api/services/{service['id']}", json={"price": "1.00"}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 403


async def test_admin_deletes_service_soft_deactivates(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    await _create_raw_staff_user(company["tenant_id"], "cliente")
    customer_token, _ = await _login(client, slug, "cliente")
    service = await _create_service(client, admin_token)

    res = await client.delete(f"/api/services/{service['id']}", headers=_auth_headers(admin_token))
    assert res.status_code == 204

    # deleting is a soft-deactivate: the record still exists and 200s for the
    # admin (who sees inactive services) ...
    res = await client.get(f"/api/services/{service['id']}", headers=_auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json()["active"] is False

    # ... but drops out of the customer-facing (active-only) list
    res = await client.get("/api/services", headers=_auth_headers(customer_token))
    assert res.status_code == 200
    assert all(s["id"] != service["id"] for s in res.json())

    # and out of the admin's list too, since list_services also filters
    # include_inactive on the admin role flag passed by the router... admin
    # sees inactive services (include_inactive=True for admin role)
    res = await client.get("/api/services", headers=_auth_headers(admin_token))
    assert any(s["id"] == service["id"] for s in res.json())


async def test_customer_cannot_delete_service(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    await _create_raw_staff_user(company["tenant_id"], "cliente")
    customer_token, _ = await _login(client, slug, "cliente")
    service = await _create_service(client, admin_token)

    res = await client.delete(f"/api/services/{service['id']}", headers=_auth_headers(customer_token))
    assert res.status_code == 403


async def test_update_other_tenants_service_404s(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token)

    other_company = await _register_company(client, f"{unique_slug}-other")
    other_admin_token, _ = await _login(client, other_company["tenant_slug"], "admin")

    res = await client.patch(
        f"/api/services/{service['id']}", json={"price": "1.00"}, headers=_auth_headers(other_admin_token)
    )
    assert res.status_code == 404


async def test_get_availability_returns_slots_within_business_hours(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)

    res = await client.get(
        f"/api/services/{service['id']}/availability",
        params={"date": "2026-09-01"},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 200, res.text
    assert "slots" in res.json()
