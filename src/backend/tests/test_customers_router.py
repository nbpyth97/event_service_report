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


async def test_repeat_booking_from_a_known_phone_does_not_overwrite_the_stored_name(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")

    first = await client.post(
        "/api/customers",
        json={"customer_known_name": "Maria", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    assert first.status_code == 201, first.text
    customer_id = first.json()["id"]
    assert first.json()["customer_known_name"] == "Maria"

    # Same phone, different name — the phone is already known, so the name
    # given on the first submission must stick (no ON CONFLICT DO UPDATE).
    second = await client.post(
        "/api/customers",
        json={"customer_known_name": "Not Maria", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    assert second.status_code == 201, second.text
    assert second.json()["id"] == customer_id
    assert second.json()["customer_known_name"] == "Maria"


async def test_staff_can_rename_a_customer_and_it_survives_a_repeat_booking(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")

    created = await client.post(
        "/api/customers",
        json={"customer_known_name": "Maria", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    customer_id = created.json()["id"]

    renamed = await client.put(
        f"/api/customers/{customer_id}",
        json={"customer_known_name": "Maria Silva"},
        headers=_auth_headers(admin_token),
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["customer_known_name"] == "Maria Silva"

    rebooked = await client.post(
        "/api/customers",
        json={"customer_known_name": "Someone Else", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    assert rebooked.status_code == 201, rebooked.text
    assert rebooked.json()["customer_known_name"] == "Maria Silva"


async def test_phone_normalizes_the_same_regardless_of_leading_plus_or_00(client, unique_slug):
    """Regression: normalize_phone used to keep-or-drop '+' based on whatever
    the caller sent, so "+351911111111" and "351911111111" landed as two
    different stored values and silently split one customer into two rows
    with two independent booking histories (real data hit this). Now that
    phone parsing goes through `phonenumbers` (core/phone.py::to_e164), a bare
    "351911111111" with no "+" is genuinely ambiguous (is "351" a country
    code, or the start of an 12-digit national number?) and is correctly
    rejected rather than guessed at — "00" is the other standard, unambiguous
    way to spell an international prefix instead of "+", so that's the
    no-plus variant this now checks."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")

    with_plus = await client.post(
        "/api/customers",
        json={"customer_known_name": "Maria", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    assert with_plus.status_code == 201, with_plus.text

    with_00 = await client.post(
        "/api/customers",
        json={"customer_known_name": "Not Maria", "phone": "00351911111111"},
        headers=_auth_headers(admin_token),
    )
    assert with_00.status_code == 201, with_00.text
    assert with_00.json()["id"] == with_plus.json()["id"]
    assert with_00.json()["customer_known_name"] == "Maria"


async def test_staff_can_correct_a_customers_phone(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")

    created = await client.post(
        "/api/customers",
        json={"customer_known_name": "Maria", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    customer_id = created.json()["id"]

    corrected = await client.put(
        f"/api/customers/{customer_id}",
        json={"customer_known_name": "Maria", "phone": "+351922222222"},
        headers=_auth_headers(admin_token),
    )
    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["phone"] == "+351922222222"

    # A booking against the old number no longer resolves to this customer —
    # it's a brand new phone as far as find-or-create is concerned.
    rebooked_old_number = await client.post(
        "/api/customers",
        json={"customer_known_name": "Someone Else", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    assert rebooked_old_number.status_code == 201, rebooked_old_number.text
    assert rebooked_old_number.json()["id"] != customer_id


async def test_correcting_a_phone_to_one_already_in_use_409s(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")

    await client.post(
        "/api/customers",
        json={"customer_known_name": "Maria", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    joana = await client.post(
        "/api/customers",
        json={"customer_known_name": "Joana", "phone": "+351922222222"},
        headers=_auth_headers(admin_token),
    )
    joana_id = joana.json()["id"]

    res = await client.put(
        f"/api/customers/{joana_id}",
        json={"customer_known_name": "Joana", "phone": "+351911111111"},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409, res.text

    # The failed write didn't leave Joana's row half-updated.
    unchanged = await client.get("/api/customers", headers=_auth_headers(admin_token))
    joana_row = next(c for c in unchanged.json() if c["id"] == joana_id)
    assert joana_row["phone"] == "+351922222222"


async def test_renaming_another_tenants_customer_404s(client, unique_slug):
    company_a = await _register_company(client, unique_slug)
    token_a, _ = await _login(client, company_a["tenant_slug"], "admin")
    created = await client.post(
        "/api/customers",
        json={"customer_known_name": "Maria", "phone": "+351911111111"},
        headers=_auth_headers(token_a),
    )
    customer_id = created.json()["id"]

    other_slug = f"{unique_slug}-b"
    company_b = await _register_company(client, other_slug)
    token_b, _ = await _login(client, company_b["tenant_slug"], "admin")

    res = await client.put(
        f"/api/customers/{customer_id}",
        json={"customer_known_name": "Hijacked"},
        headers=_auth_headers(token_b),
    )
    assert res.status_code == 404
