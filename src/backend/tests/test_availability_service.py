import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.database import AsyncSessionLocal
from app.core.models import Agendamento, Company
from app.domains.availability.service import DOW_KEYS, get_available_slots

# Default company settings (app/core/models.py DEFAULT_COMPANY_SETTINGS):
# mon/sun closed, tue-sat 08:00-19:00, slot_interval_min 15. Candidates step
# by slot_interval_min and are kept only when the service's full duration
# fits free from there — see availability/service.py::_candidate_slots.
TZ = ZoneInfo("Europe/Lisbon")
SLOT_INTERVAL_MIN = 15

# Anchored a month out rather than on fixed calendar dates: _candidate_slots
# now drops anything already under way, so a hardcoded day would start
# silently returning [] once real time passed it.
_ANCHOR = date.today() + timedelta(days=30)
OPEN_DAY = _ANCHOR + timedelta(days=(1 - _ANCHOR.weekday()) % 7)  # a Tuesday
CLOSED_DAY = _ANCHOR + timedelta(days=(0 - _ANCHOR.weekday()) % 7)  # a Monday


def _at(day: date, hhmm: str) -> str:
    """A start_time payload in the company's own timezone — spelled out via
    ZoneInfo rather than a literal offset so it stays right either side of a
    DST boundary, wherever _ANCHOR happens to land."""
    hour, minute = (int(part) for part in hhmm.split(":"))
    return datetime.combine(day, time(hour, minute), tzinfo=TZ).isoformat()


def _hhmm(slots) -> set[str]:
    return {s.astimezone(TZ).strftime("%H:%M") for s in slots}


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


async def _create_service(client, admin_token: str, duration_min: int = 30, name: str = "Corte") -> dict:
    res = await client.post(
        "/api/services",
        json={"name": name, "price": "50.00", "duration_min": duration_min},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _create_customer(client, admin_token: str, name: str = "Cliente", phone: str = "+351911111111") -> dict:
    res = await client.post(
        "/api/customers", json={"name": name, "phone": phone}, headers=_auth_headers(admin_token)
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _book(
    client, admin_token: str, customer_id: str, service_id: str, start_time: str, status: str | None = None
) -> dict:
    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service_id, "start_time": start_time, "customer_id": customer_id},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    agendamento = res.json()
    if status:
        async with AsyncSessionLocal() as db:
            row = await db.get(Agendamento, uuid.UUID(agendamento["id"]))
            row.status = status
            await db.commit()
    return agendamento


async def _open_all_day_today(tenant_id: str) -> date:
    """Force today open 00:00-23:59 so the already-past tests don't depend on
    which weekday the suite happens to run on. Reassigns settings rather than
    mutating it in place — JSONB columns aren't change-tracked otherwise."""
    today = datetime.now(TZ).date()
    async with AsyncSessionLocal() as db:
        company = await db.get(Company, uuid.UUID(tenant_id))
        settings = dict(company.settings)
        hours = dict(settings["business_hours"])
        hours[DOW_KEYS[today.weekday()]] = {"open": "00:00", "close": "23:59"}
        settings["business_hours"] = hours
        company.settings = settings
        await db.commit()
    return today


async def test_closed_day_returns_no_slots(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token)

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), CLOSED_DAY)
    assert slots == []


async def test_open_day_slots_step_by_slot_interval_not_by_duration(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    # 08:00-19:00 local, cursor advancing by slot_interval_min (15), a
    # candidate kept only while cursor + 30min <= close. Last start is
    # therefore 18:30 (18:30 + 30 == 19:00 exactly); 18:45 is dropped because
    # it would still be running at close.
    # Count: 630 min from 08:00 to 18:30, / 15 + 1 = 43 slots.
    assert len(slots) == 43
    assert slots[0].astimezone(TZ).strftime("%H:%M") == "08:00"
    assert slots[-1].astimezone(TZ).strftime("%H:%M") == "18:30"
    # spaced by the interval, *not* by the 30-min duration
    assert all((b - a) == timedelta(minutes=SLOT_INTERVAL_MIN) for a, b in zip(slots, slots[1:]))


async def test_slot_dropped_when_duration_would_run_past_close(client, unique_slug):
    """The interval only decides where candidates land; the duration still has
    to fit whole. A 90-min service on a 15-min grid stops well before close."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=90)

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    assert slots[-1].astimezone(TZ).strftime("%H:%M") == "17:30"  # 17:30 + 90min == 19:00
    assert all((b - a) == timedelta(minutes=SLOT_INTERVAL_MIN) for a, b in zip(slots, slots[1:]))


async def test_pending_booking_blocks_overlapping_slots(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "09:00"))  # pending, 09:00-09:30

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)
    times = _hhmm(slots)

    # On a 15-min grid a 30-min booking takes out every candidate whose own 30
    # minutes reach into it — the one at 09:00 plus the two straddling it.
    assert not (times & {"08:45", "09:00", "09:15"})
    # Candidates that merely touch an endpoint don't overlap, so they survive.
    assert {"08:30", "09:30"} <= times


async def test_free_window_after_an_off_grid_booking_is_offered(client, unique_slug):
    """The regression the interval grid exists to fix. A 30-min booking at
    08:00 leaves 08:30 onward free, but a 45-min service stepping by its own
    duration would have jumped 08:00 -> 08:45 and never offered 08:30."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    short = await _create_service(client, admin_token, duration_min=30)
    long_service = await _create_service(client, admin_token, duration_min=45, name="Coloracao")
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, customer["id"], short["id"], _at(OPEN_DAY, "08:00"))  # 08:00-08:30

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(
            db, uuid.UUID(company["tenant_id"]), uuid.UUID(long_service["id"]), OPEN_DAY
        )
    times = _hhmm(slots)

    assert "08:30" in times  # 08:30-09:15, genuinely free
    assert not (times & {"08:00", "08:15"})  # both would run into the booking


async def test_busy_is_tenant_wide_not_per_service(client, unique_slug):
    """One booking blocks every service, whichever service it was for — the
    business is modelled as a single resource."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    booked = await _create_service(client, admin_token, duration_min=30)
    other = await _create_service(client, admin_token, duration_min=30, name="Manicure")
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, customer["id"], booked["id"], _at(OPEN_DAY, "09:00"))

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(other["id"]), OPEN_DAY)

    assert "09:00" not in _hhmm(slots)


async def test_declined_and_cancelled_bookings_do_not_block_slots(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "09:00"), status="declined")
    await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "10:00"), status="cancelled")

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    assert {"09:00", "10:00"} <= _hhmm(slots)


async def test_slots_already_under_way_are_not_offered(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    today = await _open_all_day_today(company["tenant_id"])

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), today)

    now = datetime.now(timezone.utc)
    assert all(s >= now for s in slots)
    assert "00:00" not in _hhmm(slots)  # the day opened hours ago


async def test_booking_a_time_already_past_is_rejected(client, unique_slug):
    """is_slot_bookable shares _candidate_slots, so the write path inherits the
    same rule — a slot the picker won't show can't be booked either."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)
    today = await _open_all_day_today(company["tenant_id"])

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": _at(today, "00:00"), "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409, res.text
    assert res.json()["detail"] == "Horário não está mais disponível"


async def test_off_interval_start_time_is_rejected(client, unique_slug):
    """A start that isn't on the slot_interval_min grid was never offered, so
    the write path refuses it even though the time itself is free."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": _at(OPEN_DAY, "09:07"), "customer_id": customer["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409, res.text


async def test_start_time_outside_business_hours_is_rejected(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    for hhmm in ("07:00", "18:45"):  # before open; too late to fit 30min before close
        res = await client.post(
            "/api/agendamentos",
            json={"service_id": service["id"], "start_time": _at(OPEN_DAY, hhmm), "customer_id": customer["id"]},
            headers=_auth_headers(admin_token),
        )
        assert res.status_code == 409, f"{hhmm}: {res.text}"


async def _insert_raw_booking(tenant_id: str, service_id: str, customer_id: str, start: datetime, end: datetime):
    """Bypasses the API because is_slot_bookable would refuse these — they sit
    outside business hours by construction. Models a booking made before the
    hours were narrowed, which _candidate_slots must still treat as busy."""
    async with AsyncSessionLocal() as db:
        db.add(
            Agendamento(
                tenant_id=uuid.UUID(tenant_id),
                service_id=uuid.UUID(service_id),
                customer_id=uuid.UUID(customer_id),
                created_by=None,
                start_time=start,
                end_time=end,
                status="confirmed",
            )
        )
        await db.commit()


def _lisbon(day: date, hhmm: str) -> datetime:
    hour, minute = (int(part) for part in hhmm.split(":"))
    return datetime.combine(day, time(hour, minute), tzinfo=TZ)


async def test_service_longer_than_the_working_day_has_no_slots(client, unique_slug):
    """An 11-hour day cannot hold a 12-hour service. Not an error — the loop
    condition simply never passes, so the picker shows an empty day."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=700)

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)
    assert slots == []


async def test_confirmed_booking_blocks_slots(client, unique_slug):
    """The pending case is covered above; confirmed must block identically —
    both statuses are what list_busy_intervals selects."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    booking = await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "09:00"))
    res = await client.patch(
        f"/api/agendamentos/{booking['id']}/status",
        json={"status": "confirmed"},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 200, res.text

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    assert not (_hhmm(slots) & {"08:45", "09:00", "09:15"})


async def test_another_tenants_booking_does_not_block(client, unique_slug):
    """Isolation runs through the availability path too: busy intervals are
    filtered by tenant_id, so a neighbour filling their day stays invisible."""
    mine = await _register_company(client, unique_slug)
    my_token, _ = await _login(client, mine["tenant_slug"], "admin")
    my_service = await _create_service(client, my_token, duration_min=30)

    theirs = await _register_company(client, f"{unique_slug}-other")
    their_token, _ = await _login(client, theirs["tenant_slug"], "admin")
    their_service = await _create_service(client, their_token, duration_min=30)
    their_customer = await _create_customer(client, their_token, phone="+351922222222")
    await _book(client, their_token, their_customer["id"], their_service["id"], _at(OPEN_DAY, "09:00"))

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(mine["tenant_id"]), uuid.UUID(my_service["id"]), OPEN_DAY)

    assert "09:00" in _hhmm(slots)


async def test_booking_starting_before_open_still_blocks(client, unique_slug):
    """list_busy_intervals catches anything *overlapping* the window, not just
    contained in it — otherwise a booking that began before opening would leak
    its tail into the offered slots."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    await _insert_raw_booking(
        company["tenant_id"],
        service["id"],
        customer["id"],
        _lisbon(OPEN_DAY, "07:00"),
        _lisbon(OPEN_DAY, "08:30"),
    )

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)
    times = _hhmm(slots)

    assert not (times & {"08:00", "08:15"})  # both run into the 08:30 tail
    assert "08:30" in times  # touches the end, does not overlap


async def test_booking_running_past_close_still_blocks(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    await _insert_raw_booking(
        company["tenant_id"],
        service["id"],
        customer["id"],
        _lisbon(OPEN_DAY, "18:15"),
        _lisbon(OPEN_DAY, "19:45"),
    )

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    assert slots[-1].astimezone(TZ).strftime("%H:%M") == "17:45"  # 17:45-18:15 touches the booking


async def test_booking_at_end_of_day_blocks_the_last_candidates(client, unique_slug):
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "18:30"))  # 18:30-19:00

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)

    # 18:15 would run to 18:45, into the booking; 18:30 is the booking itself.
    assert slots[-1].astimezone(TZ).strftime("%H:%M") == "18:00"


async def test_business_hours_are_wall_clock_across_dst(client, unique_slug):
    """Opening time is a clock reading, not a fixed UTC instant: 08:00 stays
    08:00 in winter and summer while the underlying offset moves. Building
    slots from ZoneInfo rather than a stored offset is what guarantees it."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)

    year = date.today().year + 1

    def first_tuesday(month: int) -> date:
        first = date(year, month, 1)
        return first + timedelta(days=(1 - first.weekday()) % 7)

    winter, summer = first_tuesday(1), first_tuesday(7)  # WET (+00:00) / WEST (+01:00)

    async with AsyncSessionLocal() as db:
        tenant, svc = uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"])
        winter_slots = await get_available_slots(db, tenant, svc, winter)
        summer_slots = await get_available_slots(db, tenant, svc, summer)

    # Same wall-clock opening on both sides of the transition...
    assert winter_slots[0].astimezone(TZ).strftime("%H:%M") == "08:00"
    assert summer_slots[0].astimezone(TZ).strftime("%H:%M") == "08:00"
    # ...reached from different UTC offsets, so they are different instants.
    assert winter_slots[0].utcoffset() != summer_slots[0].utcoffset()
    assert len(winter_slots) == len(summer_slots)


async def test_double_booking_the_same_slot_is_rejected(client, unique_slug):
    """The lost-race path: the second request recomputes the day, no longer
    finds its slot, and 409s rather than overbooking."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    first = await _create_customer(client, admin_token)
    second = await _create_customer(client, admin_token, name="Outra", phone="+351933333333")

    await _book(client, admin_token, first["id"], service["id"], _at(OPEN_DAY, "09:00"))

    res = await client.post(
        "/api/agendamentos",
        json={"service_id": service["id"], "start_time": _at(OPEN_DAY, "09:00"), "customer_id": second["id"]},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 409, res.text
    assert res.json()["detail"] == "Horário não está mais disponível"


async def test_overlapping_booking_is_refused_by_the_database(client, unique_slug):
    """The backstop, exercised past the gate. is_slot_bookable is what returns
    409 for real traffic, but it is a SELECT before an INSERT and cannot be
    atomic — so this inserts straight through the repository to prove the
    constraint itself refuses an overlap, which is what covers the race the
    service layer structurally cannot."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=60)
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "09:00"))  # 09:00-10:00

    # Straddles the existing booking without sharing its start_time — the case
    # a UNIQUE(tenant_id, service_id, start_time) key would have let through.
    with pytest.raises(IntegrityError):
        await _insert_raw_booking(
            company["tenant_id"],
            service["id"],
            customer["id"],
            _lisbon(OPEN_DAY, "09:30"),
            _lisbon(OPEN_DAY, "10:30"),
        )


async def test_touching_bookings_are_allowed_by_the_database(client, unique_slug):
    """tstzrange is '[)', so back-to-back bookings do not overlap — the
    constraint agrees with _candidate_slots' half-open test rather than
    quietly forbidding a legal neighbour."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "09:00"))  # 09:00-09:30

    await _insert_raw_booking(  # 09:30-10:00, starts exactly where the other ends
        company["tenant_id"],
        service["id"],
        customer["id"],
        _lisbon(OPEN_DAY, "09:30"),
        _lisbon(OPEN_DAY, "10:00"),
    )

    async with AsyncSessionLocal() as db:
        slots = await get_available_slots(db, uuid.UUID(company["tenant_id"]), uuid.UUID(service["id"]), OPEN_DAY)
    assert "10:00" in _hhmm(slots)


async def test_cancelled_booking_frees_its_range_at_the_database_level(client, unique_slug):
    """The partial WHERE: a cancelled row leaves the index, so its time can be
    booked again. Mirrors list_busy_intervals ignoring the same statuses."""
    company = await _register_company(client, unique_slug)
    admin_token, _ = await _login(client, company["tenant_slug"], "admin")
    service = await _create_service(client, admin_token, duration_min=30)
    customer = await _create_customer(client, admin_token)

    booking = await _book(client, admin_token, customer["id"], service["id"], _at(OPEN_DAY, "09:00"))
    res = await client.patch(
        f"/api/agendamentos/{booking['id']}/status",
        json={"status": "cancelled"},
        headers=_auth_headers(admin_token),
    )
    assert res.status_code == 200, res.text

    # Same range as the cancelled one — legal now that it has left the index.
    await _insert_raw_booking(
        company["tenant_id"],
        service["id"],
        customer["id"],
        _lisbon(OPEN_DAY, "09:00"),
        _lisbon(OPEN_DAY, "09:30"),
    )


async def test_another_tenant_may_hold_the_very_same_range(client, unique_slug):
    """tenant_id WITH = scopes the constraint: two companies booking the same
    wall-clock hour are not a conflict, they are two different chairs."""
    mine = await _register_company(client, unique_slug)
    my_token, _ = await _login(client, mine["tenant_slug"], "admin")
    my_service = await _create_service(client, my_token, duration_min=30)
    my_customer = await _create_customer(client, my_token)
    await _book(client, my_token, my_customer["id"], my_service["id"], _at(OPEN_DAY, "09:00"))

    theirs = await _register_company(client, f"{unique_slug}-b")
    their_token, _ = await _login(client, theirs["tenant_slug"], "admin")
    their_service = await _create_service(client, their_token, duration_min=30)
    their_customer = await _create_customer(client, their_token, phone="+351944444444")

    # Identical range, different tenant — must be accepted.
    await _insert_raw_booking(
        theirs["tenant_id"],
        their_service["id"],
        their_customer["id"],
        _lisbon(OPEN_DAY, "09:00"),
        _lisbon(OPEN_DAY, "09:30"),
    )
