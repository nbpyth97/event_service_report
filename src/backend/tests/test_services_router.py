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


async def test_admin_deletes_service_soft_deactivates(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)

    res = await client.delete(f"/api/services/{service['id']}", headers=_auth_headers(admin_token))
    assert res.status_code == 204

    # deleting is a soft-deactivate: the record still exists and 200s for staff
    res = await client.get(f"/api/services/{service['id']}", headers=_auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json()["active"] is False

    # staff keep seeing it in their list (include_inactive=True — the CRUD view
    # has to be able to reactivate it)
    res = await client.get("/api/services", headers=_auth_headers(admin_token))
    assert any(s["id"] == service["id"] for s in res.json())

    # ... but it drops out of the customer-facing list, which is the public
    # endpoint now that authenticated callers are all staff
    res = await client.get(f"/api/public/{slug}/services")
    assert res.status_code == 200
    assert all(s["id"] != service["id"] for s in res.json())


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


async def test_delete_other_tenants_service_404s(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token)

    other_company = await _register_company(client, f"{unique_slug}-other")
    other_admin_token, _ = await _login(client, other_company["tenant_slug"], "admin")

    res = await client.delete(f"/api/services/{service['id']}", headers=_auth_headers(other_admin_token))
    assert res.status_code == 404

    # still active for its real owner
    res = await client.get(f"/api/services/{service['id']}", headers=_auth_headers(admin_token))
    assert res.json()["active"] is True


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
