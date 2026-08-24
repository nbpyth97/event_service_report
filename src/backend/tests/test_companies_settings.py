"""PATCH /api/companies/me — the company-settings surface behind the avatar in
the top bar. The interesting cases are all about the JSONB merge: settings is a
plain JSONB column with no MutableDict tracking, so a patch that fails to
reassign a fresh dict silently emits no UPDATE at all, and a patch that
replaces the blob wholesale would drop every key it didn't send."""

OPEN_WEEK = {
    "mon": {"open": "10:00", "close": "20:00"},
    "tue": {"open": "10:00", "close": "20:00"},
    "wed": {"open": "10:00", "close": "20:00"},
    "thu": {"open": "10:00", "close": "20:00"},
    "fri": {"open": "10:00", "close": "20:00"},
    "sat": None,
    "sun": None,
}


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
    return res.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _staff_client(client, slug: str):
    company = await _register_company(client, slug)
    token = await _login(client, company["tenant_slug"], "admin")
    return company, _auth_headers(token)


async def test_patch_updates_name_and_settings(client, unique_slug):
    company, headers = await _staff_client(client, unique_slug)

    res = await client.patch(
        "/api/companies/me",
        headers=headers,
        json={
            "name": "Salão Novo",
            "settings": {"timezone": "Atlantic/Azores", "slot_interval_min": 30, "business_hours": OPEN_WEEK},
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Salão Novo"
    assert body["settings"]["timezone"] == "Atlantic/Azores"
    assert body["settings"]["slot_interval_min"] == 30
    assert body["settings"]["business_hours"] == OPEN_WEEK
    # Untouched, and not settable through this endpoint.
    assert body["slug"] == company["tenant_slug"]

    # Reread rather than trusting the response object: the JSONB reassignment
    # is exactly what a missing UPDATE would hide.
    res = await client.get("/api/companies/me", headers=headers)
    assert res.json()["settings"]["slot_interval_min"] == 30
    assert res.json()["name"] == "Salão Novo"


async def test_patch_merges_settings_instead_of_replacing(client, unique_slug):
    _, headers = await _staff_client(client, unique_slug)
    before = (await client.get("/api/companies/me", headers=headers)).json()["settings"]

    res = await client.patch("/api/companies/me", headers=headers, json={"settings": {"slot_interval_min": 20}})
    assert res.status_code == 200, res.text
    after = res.json()["settings"]

    assert after["slot_interval_min"] == 20
    assert after["timezone"] == before["timezone"]
    assert after["business_hours"] == before["business_hours"]


async def test_patch_name_only_leaves_settings_intact(client, unique_slug):
    _, headers = await _staff_client(client, unique_slug)
    before = (await client.get("/api/companies/me", headers=headers)).json()["settings"]

    res = await client.patch("/api/companies/me", headers=headers, json={"name": "Só o nome"})
    assert res.status_code == 200, res.text
    assert res.json()["settings"] == before


async def test_new_hours_drive_availability(client, unique_slug):
    """The settings page is only worth anything if the slot picker follows it:
    a day switched to closed must stop producing candidates."""
    _, headers = await _staff_client(client, unique_slug)
    res = await client.post(
        "/api/services", headers=headers, json={"name": "Corte", "price": "10.00", "duration_min": 30}
    )
    assert res.status_code == 201, res.text
    service_id = res.json()["id"]

    # Far enough out that "not in the past" never trims the whole day, and on a
    # weekday the default settings already have open (Tuesday).
    from datetime import date, timedelta

    day = date.today() + timedelta(days=30)
    while day.weekday() != 1:  # 1 == Tuesday == DOW_KEYS[1] == "tue"
        day += timedelta(days=1)

    url = f"/api/services/{service_id}/availability?date={day.isoformat()}"
    assert len((await client.get(url, headers=headers)).json()["slots"]) > 0

    closed = {**OPEN_WEEK, "tue": None}
    res = await client.patch("/api/companies/me", headers=headers, json={"settings": {"business_hours": closed}})
    assert res.status_code == 200, res.text

    assert (await client.get(url, headers=headers)).json()["slots"] == []


async def test_patch_rejects_slug_and_bad_values(client, unique_slug):
    _, headers = await _staff_client(client, unique_slug)

    for payload in (
        {"slug": "outro-slug"},  # not editable: public booking links carry it
        {"name": None},  # null means "not sent" here, so it can't clear a field
        {"name": ""},
        {"settings": {"timezone": "Mars/Olympus"}},
        {"settings": {"slot_interval_min": 0}},
        {"settings": {"slot_interval_min": 1000}},
        {"settings": {"business_hours": {"mon": {"open": "09:00", "close": "18:00"}}}},  # partial week
        {"settings": {"business_hours": {**OPEN_WEEK, "mon": {"open": "19:00", "close": "09:00"}}}},  # close <= open
        {"settings": {"business_hours": {**OPEN_WEEK, "mon": {"open": "9:00", "close": "18:00"}}}},  # not HH:MM
        # lunch_break end before start
        {
            "settings": {
                "business_hours": {
                    **OPEN_WEEK,
                    "mon": {"open": "10:00", "close": "20:00", "lunch_break": {"start": "14:00", "end": "13:00"}},
                }
            }
        },
        # lunch_break outside the day's open/close window
        {
            "settings": {
                "business_hours": {
                    **OPEN_WEEK,
                    "mon": {"open": "10:00", "close": "20:00", "lunch_break": {"start": "09:00", "end": "13:00"}},
                }
            }
        },
    ):
        res = await client.patch("/api/companies/me", headers=headers, json=payload)
        assert res.status_code == 422, f"{payload} was accepted: {res.text}"


async def test_patch_accepts_lunch_break_within_hours(client, unique_slug):
    _, headers = await _staff_client(client, unique_slug)
    week = {**OPEN_WEEK, "mon": {"open": "10:00", "close": "20:00", "lunch_break": {"start": "13:00", "end": "14:00"}}}

    res = await client.patch("/api/companies/me", headers=headers, json={"settings": {"business_hours": week}})
    assert res.status_code == 200, res.text
    assert res.json()["settings"]["business_hours"]["mon"]["lunch_break"] == {"start": "13:00", "end": "14:00"}


async def test_patch_requires_auth(client):
    res = await client.patch("/api/companies/me", json={"name": "Anónimo"})
    assert res.status_code == 401


async def test_patch_only_ever_touches_own_tenant(client, unique_slug):
    """tenant_id comes from the JWT, never the body — there is no path by which
    one company's admin can reach another's settings."""
    _, headers_a = await _staff_client(client, f"{unique_slug}-a")
    company_b, headers_b = await _staff_client(client, f"{unique_slug}-b")

    res = await client.patch("/api/companies/me", headers=headers_a, json={"name": "Renomeada por A"})
    assert res.status_code == 200

    res = await client.get("/api/companies/me", headers=headers_b)
    assert res.json()["name"] != "Renomeada por A"
    assert res.json()["id"] == company_b["tenant_id"]
