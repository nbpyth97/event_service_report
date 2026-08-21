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


async def test_new_booking_notifies_all_tenant_admins_and_not_other_tenants(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, admin = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)

    other_company = await _register_company(client, f"{unique_slug}-other")
    other_admin_token, _ = await _login(client, other_company["tenant_slug"], "admin")

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:00:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text

    res = await client.get("/api/notifications", headers=_auth_headers(admin_token))
    assert res.status_code == 200
    notifications = res.json()
    assert len(notifications) == 1
    assert notifications[0]["type"] == "booking_pending"
    assert notifications[0]["read_at"] is None

    # other tenant's admin sees nothing (tenant isolation)
    res = await client.get("/api/notifications", headers=_auth_headers(other_admin_token))
    assert res.status_code == 200
    assert res.json() == []


async def test_confirmed_booking_cancelled_notifies_admin_but_declining_a_pending_one_does_not(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)

    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

    # declining a still-pending booking must not fire a "cancelled"
    # notification, and resolves (marks read) the "booking_pending" alert
    # that prompted it — it's no longer actionable once declined.
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    res = await client.get("/api/notifications", headers=_auth_headers(admin_token))
    assert res.json() == []

    # now confirm a second booking, then cancel it — this one should notify
    agendamento2 = await _book(client, admin_token, service["id"], "2026-09-02T10:00:00Z", customer["id"])
    res = await client.patch(
        f"/api/agendamentos/{agendamento2['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    # confirming resolves its own booking_pending notification too
    res = await client.get("/api/notifications", headers=_auth_headers(admin_token))
    assert res.json() == []

    res = await client.patch(
        f"/api/agendamentos/{agendamento2['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    res = await client.get("/api/notifications", headers=_auth_headers(admin_token))
    types = [n["type"] for n in res.json()]
    assert types.count("booking_cancelled") == 1


async def test_mark_notification_read(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

    res = await client.get("/api/notifications", headers=_auth_headers(admin_token))
    notification_id = res.json()[0]["id"]

    res = await client.post(f"/api/notifications/{notification_id}/read", headers=_auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json()["read_at"] is not None

    # the list is unread-only, so a read notification drops out of it
    res = await client.get("/api/notifications", headers=_auth_headers(admin_token))
    assert res.json() == []


async def test_mark_other_tenants_notification_read_404s(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])
    res = await client.get("/api/notifications", headers=_auth_headers(admin_token))
    notification_id = res.json()[0]["id"]

    other_company = await _register_company(client, f"{unique_slug}-other")
    other_admin_token, _ = await _login(client, other_company["tenant_slug"], "admin")

    res = await client.post(f"/api/notifications/{notification_id}/read", headers=_auth_headers(other_admin_token))
    assert res.status_code == 404
