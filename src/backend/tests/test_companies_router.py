async def _register_company(client, slug: str):
    res = await client.post(
        "/api/auth/register-company",
        json={"company_name": "Acme", "company_slug": slug, "admin_name": "admin", "password": "supersecret1"},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _login(client, slug: str, name: str, password: str = "supersecret1"):
    res = await client.post("/api/auth/login", json={"tenant_slug": slug, "name": name, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"], res.json()["user"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_get_my_company_returns_own_tenant(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")

    res = await client.get("/api/companies/me", headers=_auth_headers(admin_token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["id"] == company["tenant_id"]
    assert body["slug"] == unique_slug


async def test_get_my_company_requires_auth(client):
    res = await client.get("/api/companies/me")
    assert res.status_code == 401
