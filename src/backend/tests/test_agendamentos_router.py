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


async def _create_service(client, admin_token: str) -> dict:
    res = await client.post(
        "/api/services", json={"name": "Corte", "price": "50.00", "duration_min": 30}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _book(client, customer_token: str, service_id: str, start_time: str = "2026-09-01T10:00:00Z") -> dict:
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service_id, "start_time": start_time},
        headers=_auth_headers(customer_token),
    )
    assert res.status_code == 201, res.text
    return res.json()


async def test_confirming_a_declined_booking_is_rejected(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    # pending -> confirmed|declined only; declined is terminal
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 409


async def test_declining_a_confirmed_booking_is_rejected(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    # confirmed -> cancelled only; declined is not a valid next state
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 409


async def test_cancelling_a_cancelled_booking_is_rejected(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    # cancelled is terminal — no transitions out of it
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 409


async def test_owner_cancelling_an_already_cancelled_booking_is_rejected(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 200

    # cancelled is terminal — same 409 an admin would get, not a 404
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 409


async def test_update_status_on_other_tenants_booking_404s(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    other_slug = f"{unique_slug}-other"
    await _register_company(client, other_slug)
    other_admin_token, _ = await _login(client, other_slug, "admin")

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status",
        json={"status": "confirmed"},
        headers=_auth_headers(other_admin_token),
    )
    assert res.status_code == 404


async def test_owner_can_cancel_own_pending_booking(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


async def test_owner_can_cancel_own_declined_booking(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


async def test_owner_can_cancel_own_confirmed_booking(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(customer_token)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


async def test_non_owner_customer_cannot_change_others_pending_booking(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug, name="cliente")
    customer_token, _ = await _login(client, unique_slug, "cliente")
    await _register_customer(client, unique_slug, name="outro")
    other_customer_token, _ = await _login(client, unique_slug, "outro")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status",
        json={"status": "cancelled"},
        headers=_auth_headers(other_customer_token),
    )
    assert res.status_code == 404


async def test_admin_can_cancel_declined_booking(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    await _register_customer(client, unique_slug)
    customer_token, _ = await _login(client, unique_slug, "cliente")
    service = await _create_service(client, admin_token)
    agendamento = await _book(client, customer_token, service["id"])

    await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


async def test_book_other_tenants_service_404s(client, unique_slug):
    await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, unique_slug, "admin")
    service = await _create_service(client, admin_token)

    other_slug = f"{unique_slug}-other"
    await _register_company(client, other_slug)
    await _register_customer(client, other_slug)
    other_customer_token, _ = await _login(client, other_slug, "cliente")

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:00:00Z"},
        headers=_auth_headers(other_customer_token),
    )
    assert res.status_code == 404
