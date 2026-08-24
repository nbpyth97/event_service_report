"""One-off import of a tenant's real service list from the legacy
booking-site JSON config into Postgres, as Service rows.

Source shape (see booking-site/tenant-config/anabela/services.json):
    {
      "aliases": {...},                          # ignored — display-name shorthand, not a service
      "women": {"Perna Inteira": {"price": 20.0, "duration_min": 60, ...}, ...},
      "men":   {"Perna Inteira": {"price": 24.0, "duration_min": 90, ...}, ...}
    }
Only "price" and "duration_min" are read from each entry — wax_g/wax_cost/
disposables/extras/total_cost are cost-accounting fields with nowhere to go
in the current schema (Service has no `cost` column — see CLAUDE.md's
Dashboard note) and are dropped here, not migrated.

"women" and "men" frequently share a service name ("Perna Inteira", "Pés",
"Mãos", ...) at a different price/duration — Service has no per-tenant
uniqueness constraint on `name`, so two identical-looking rows would be
genuinely ambiguous to a customer on the public booking page. Each name is
suffixed " (Mulher)" / " (Homem)" to disambiguate, except where a name
appears in only one of the two sections (already unambiguous).

The actual Postgres write only works from inside the backend container — the
host has no network route to `postgres` (see CLAUDE.md's Tests section) —
but `booking-site/` isn't copied into that container's image (only
`src/backend`'s own contents are). So --file has no default: copy the JSON
in first, then point --file at wherever you put it, e.g.:

    docker compose cp booking-site/tenant-config/anabela/services.json \
        backend:/tmp/services.json
    docker compose exec backend uv run python -m scripts.import_services_from_json \
        --file /tmp/services.json
    docker compose exec backend uv run python -m scripts.import_services_from_json \
        --file /tmp/services.json --apply

Dry-run by default (prints what it would create) — pass --apply to actually
insert. Idempotent re-run: an (tenant_id, name) pair that already exists is
skipped, not duplicated. --tenant-slug defaults to "salao-anabela" (the pilot
tenant) — pass it explicitly to target a different company.
"""

import argparse
import asyncio
import json
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.models import Company, Service, User
from app.core.schemas import ServiceCreate
from app.domains.services import service as services_service

# Keys in services.json that aren't service categories.
_NON_CATEGORY_KEYS = {"aliases"}

_SECTION_SUFFIX = {"women": "Mulher", "men": "Homem"}


def parse_services(data: dict) -> list[tuple[str, Decimal, int]]:
    """Flatten the women/men sections into (name, price, duration_min)
    triples, disambiguating names shared by both sections."""
    sections = {k: v for k, v in data.items() if k not in _NON_CATEGORY_KEYS}
    shared_names = set.intersection(*(set(entries) for entries in sections.values())) if len(sections) > 1 else set()

    parsed: list[tuple[str, Decimal, int]] = []
    for section, entries in sections.items():
        suffix = f" ({_SECTION_SUFFIX[section]})" if section in _SECTION_SUFFIX and section in sections else ""
        for name, fields in entries.items():
            label = f"{name}{suffix}" if name in shared_names else name
            parsed.append((label, Decimal(str(fields["price"])), int(fields["duration_min"])))
    return parsed


async def import_services(json_path: Path, tenant_slug: str, apply: bool) -> None:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    to_create = parse_services(data)

    async with AsyncSessionLocal() as db:
        company = (await db.execute(select(Company).where(Company.slug == tenant_slug))).scalar_one_or_none()
        if company is None:
            raise SystemExit(f"No company with slug '{tenant_slug}'.")

        admin = (await db.execute(select(User).where(User.tenant_id == company.id))).scalars().first()
        if admin is None:
            raise SystemExit(f"Company '{tenant_slug}' has no user to attribute created_by to.")

        existing_names = set(
            (await db.execute(select(Service.name).where(Service.tenant_id == company.id))).scalars().all()
        )

        created, skipped = 0, 0
        for name, price, duration_min in to_create:
            if name in existing_names:
                skipped += 1
                continue
            print(f"{'CREATE' if apply else 'DRY-RUN'}: {name!r} — {price}€, {duration_min}min")
            if apply:
                await services_service.create_service(
                    db, company.id, admin.id, ServiceCreate(name=name, price=price, duration_min=duration_min)
                )
            created += 1

        if apply:
            await db.commit()

        verb = "Created" if apply else "Would create"
        print(f"\n{verb} {created} service(s), skipped {skipped} already-existing.")
        if not apply:
            print("Dry run only — re-run with --apply to actually insert.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, required=True, help="Path to services.json")
    parser.add_argument(
        "--tenant-slug",
        default="salao-anabela",
        help="Slug of the company to insert services into (default: salao-anabela, the pilot tenant)",
    )
    parser.add_argument("--apply", action="store_true", help="Actually insert — omit for a dry run")
    args = parser.parse_args()
    asyncio.run(import_services(args.file, args.tenant_slug, args.apply))


if __name__ == "__main__":
    main()
