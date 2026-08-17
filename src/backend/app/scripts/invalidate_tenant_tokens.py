"""CLI-only, SSH-access-gated tenant-wide refresh token revocation.

Usage: uv run python -m app.scripts.invalidate_tenant_tokens <tenant_slug>

Deliberately not an HTTP endpoint (see plan Part B.3) — invalidating every
refresh token for a whole company is an incident-response action, and giving
it a network-reachable path (even behind its own role/account) would be a
permanent extra attack surface for something that should require someone
already having shell access to the server. It can be triggered without an
interactive shell via the "Invalidate tenant tokens" GitHub Actions workflow
(workflow_dispatch), which SSHes in and runs this script the same way.
"""

import asyncio
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.models import Company
from app.domains.auth.service import revoke_all_tokens_for_tenant


async def main(tenant_slug: str) -> None:
    async with AsyncSessionLocal() as db:
        company = (await db.execute(select(Company).where(Company.slug == tenant_slug))).scalar_one_or_none()
        if not company:
            print(f"No company found with slug {tenant_slug!r}", file=sys.stderr)
            sys.exit(1)
        print(f"Resolved slug {tenant_slug!r} -> {company.name!r} ({company.id})")
        count = await revoke_all_tokens_for_tenant(db, company.id)
    print(f"Revoked {count} active refresh token(s) for tenant {company.id}.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m app.scripts.invalidate_tenant_tokens <tenant_slug>", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
