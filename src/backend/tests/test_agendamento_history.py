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


async def _create_service(client, admin_token: str) -> dict:
    res = await client.post(
        "/api/services", json={"name": "Corte", "price": "50.00", "duration_min": 30}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _create_customer(client, admin_token: str, name: str = "Cliente", phone: str = "+351911111111") -> dict:
    res = await client.post(
        "/api/customers", json={"customer_known_name": name, "phone": phone}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _book(client, admin_token: str, service_id: str, start_time: str, customer_id: str) -> dict:
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service_id, "start_time": start_time, "customer_id": customer_id},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    return res.json()


async def test_history_records_pending_then_confirmed(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    res = await client.get(f"/api/agendamentos/{agendamento['id']}/history", headers=_auth_headers(admin_token))
    assert res.status_code == 200
    history = res.json()

    assert [h["to_status"] for h in history] == ["pending", "confirmed"]
    assert history[0]["from_status"] is None
    assert history[1]["from_status"] == "pending"
    # ordered chronologically
    assert history[0]["changed_at"] <= history[1]["changed_at"]


async def test_history_records_every_transition_in_order(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

    await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(admin_token)
    )

    res = await client.get(f"/api/agendamentos/{agendamento['id']}/history", headers=_auth_headers(admin_token))
    history = res.json()
    assert [(h["from_status"], h["to_status"]) for h in history] == [
        (None, "pending"),
        ("pending", "confirmed"),
        ("confirmed", "cancelled"),
    ]
