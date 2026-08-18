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
        "/api/customers", json={"name": name, "phone": phone}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _book(client, admin_token: str, service_id: str, start_time: str, customer_id: str) -> dict:
    """Admin-only manual-appointment booking — POST /api/agendamentos is
    require_admin-gated now (see routers/agendamentos.py). Tests that
    specifically exercise the anonymous public path use _public_book
    (below) instead."""
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service_id, "start_time": start_time, "customer_id": customer_id},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _public_book(
    client, slug: str, service_id: str, start_time: str, name: str = "Cliente", phone: str = "+351911111111"
) -> dict:
    res = await client.post(
        f"/api/public/{slug}/book",
        json={"service_id": service_id, "start_time": start_time, "name": name, "phone": phone},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def test_confirming_a_declined_booking_is_rejected(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

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

    # confirmed -> cancelled only; declined is not a valid next state
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 409


async def test_cancelling_a_cancelled_booking_is_rejected(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

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


async def test_update_status_on_other_tenants_booking_404s(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

    other_company = await _register_company(client, f"{unique_slug}-other")
    other_admin_token, _ = await _login(client, other_company["tenant_slug"], "admin")

    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status",
        json={"status": "confirmed"},
        headers=_auth_headers(other_admin_token),
    )
    assert res.status_code == 404


async def test_admin_can_cancel_declined_booking(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

    await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )
    res = await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "cancelled"}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


async def test_booking_overlapping_pending_slot_is_rejected(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)  # 30-min duration
    customer = await _create_customer(client, admin_token)
    await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])  # 10:00-10:30, stays pending

    # 10:15-10:45 partially overlaps the 10:00-10:30 pending booking
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:15:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "Horário não está mais disponível"


async def test_booking_overlapping_confirmed_slot_is_rejected(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)  # 30-min duration
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])
    await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "confirmed"}, headers=_auth_headers(admin_token)
    )

    # exact same start/end as the now-confirmed 10:00-10:30 booking
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:00:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409


async def test_booking_back_to_back_slot_is_allowed(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)  # 30-min duration
    customer = await _create_customer(client, admin_token)
    await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])  # 10:00-10:30

    # starts exactly when the previous booking ends -> no overlap ([start, end) semantics)
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:30:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201


async def test_booking_overlapping_declined_slot_is_allowed(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)  # 30-min duration
    customer = await _create_customer(client, admin_token)
    agendamento = await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])
    await client.patch(
        f"/api/agendamentos/{agendamento['id']}/status", json={"status": "declined"}, headers=_auth_headers(admin_token)
    )

    # declined bookings don't hold the slot
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:00:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201


async def test_booking_overlapping_other_service_is_rejected(client, unique_slug):
    """Busy time is tenant-wide, not per-service — see availability/repository.py."""
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service_a = await _create_service(client, admin_token)
    res = await client.post(
        "/api/services", json={"name": "Manicure", "price": "20.00", "duration_min": 30}, headers=_auth_headers(admin_token)
    )
    service_b = res.json()
    customer = await _create_customer(client, admin_token)
    await _book(client, admin_token, service_a["id"], "2026-09-01T10:00:00Z", customer["id"])  # 10:00-10:30

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service_b["id"], "start_time": "2026-09-01T10:15:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409


async def test_booking_overlapping_slot_in_another_tenant_is_allowed(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)
    await _book(client, admin_token, service["id"], "2026-09-01T10:00:00Z", customer["id"])

    other_company = await _register_company(client, f"{unique_slug}-other")
    other_admin_token, _ = await _login(client, other_company["tenant_slug"], "admin")
    other_service = await _create_service(client, other_admin_token)
    other_customer = await _create_customer(client, other_admin_token)

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": other_service["id"], "start_time": "2026-09-01T10:00:00Z", "customer_id": other_customer["id"]},
        headers=_auth_headers(other_admin_token),
    )
    assert res.status_code == 201


async def test_booking_on_closed_day_is_rejected(client, unique_slug):
    """Write path now reuses availability_service's business-hours check
    (via is_slot_bookable), not just the busy-overlap check."""
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)

    # 2026-08-31 is a Monday - default business_hours has "mon": None (closed)
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-08-31T10:00:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "Horário não está mais disponível"


async def test_booking_outside_business_hours_is_rejected(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)
    customer = await _create_customer(client, admin_token)

    # 19:00 UTC on 2026-09-01 = 20:00 Europe/Lisbon (DST) - an hour after the 19:00 local close
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T19:00:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409


async def test_booking_off_the_slot_grid_is_rejected(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)  # 30-min duration
    customer = await _create_customer(client, admin_token)

    # 10:07 UTC = 11:07 Europe/Lisbon local, not aligned to the 30-min
    # back-to-back-by-duration grid (08:00, 08:30, 09:00, ...)
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:07:00Z", "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409


async def test_book_other_tenants_service_404s(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)

    other_company = await _register_company(client, f"{unique_slug}-other")
    other_admin_token, _ = await _login(client, other_company["tenant_slug"], "admin")
    other_customer = await _create_customer(client, other_admin_token)

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": "2026-09-01T10:00:00Z", "customer_id": other_customer["id"]},
        headers=_auth_headers(other_admin_token),
    )
    assert res.status_code == 404


async def test_public_booking_succeeds_with_no_auth(client, unique_slug):
    company = await _register_company(client, unique_slug)
    slug = company["tenant_slug"]
    admin_token, _ = await _login(client, slug, "admin")
    service = await _create_service(client, admin_token)

    agendamento = await _public_book(
        client, slug, service["id"], "2026-09-01T10:00:00Z", name="Maria", phone="+351911112222"
    )

    assert agendamento["created_by"] is None
    assert agendamento["customer_name"] == "Maria"
    assert agendamento["customer_phone"] == "+351911112222"
    assert agendamento["status"] == "pending"


async def test_public_booking_unknown_tenant_404s(client):
    res = await client.post(
        "/api/public/does-not-exist/book",
        json={
            "service_id": "00000000-0000-0000-0000-000000000000",
            "start_time": "2026-09-01T10:00:00Z",
            "name": "Maria",
            "phone": "+351911112222",
        },
    )
    assert res.status_code == 404
