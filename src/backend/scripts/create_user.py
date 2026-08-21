"""One-off utility to create a staff User for an existing Company tenant.

Usage (must run inside the backend container — same constraint as any other
script here, see CLAUDE.md "Tests" section):

    docker compose exec backend uv run python -m scripts.create_user \\
        --tenant-slug salao-anabela \\
        --name "Anabela" \\
        --password "changeme123"

    # optional phone number
    docker compose exec backend uv run python -m scripts.create_user \\
        --tenant-slug salao-anabela \\
        --name "Anabela" \\
        --password "changeme123" \\
        --phone "+351912345678"

Password is hashed through the same bcrypt path used by the registration
endpoint — never stored in plain text. If a user with the same (tenant_id,
name) already exists the script exits without modifying anything.
"""

import argparse
import asyncio

from sqlalchemy import select

from app.core.auth import hash_password
from app.core.database import AsyncSessionLocal
from app.core.models import Company, User
from app.domains.auth import repository


async def create_user(tenant_slug: str, name: str, password: str, phone: str | None) -> None:
    async with AsyncSessionLocal() as db:
        company = (await db.execute(select(Company).where(Company.slug == tenant_slug))).scalar_one_or_none()
        if company is None:
            raise SystemExit(f"No company with slug '{tenant_slug}'.")

        existing = await repository.fetch_user_by_name(db, company.id, name)
        if existing is not None:
            raise SystemExit(f"User '{name}' already exists in '{tenant_slug}' — nothing changed.")

        user = User(
            tenant_id=company.id,
            name=name,
            password_hash=hash_password(password),
            phone=phone,
        )
        inserted = await repository.try_insert_user(db, user)
        if not inserted:
            # Race or a concurrent script run — name/tenant duplicate
            raise SystemExit(f"User '{name}' already exists in '{tenant_slug}' — nothing changed.")

        print(f"Created user '{name}' for company '{company.name}' (slug: {tenant_slug}, id: {user.id})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant-slug", required=True, help="Slug of the target company")
    parser.add_argument("--name", required=True, help="Login name for the new staff user (unique per tenant)")
    parser.add_argument("--password", required=True, help="Plain-text password — hashed with bcrypt before storing")
    parser.add_argument("--phone", default=None, help="Optional phone number, e.g. +351912345678")
    args = parser.parse_args()
    asyncio.run(create_user(args.tenant_slug, args.name, args.password, args.phone))


if __name__ == "__main__":
    main()
