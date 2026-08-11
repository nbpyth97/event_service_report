"""CLI-only, SSH-access-gated tenant-wide refresh token revocation.

Usage: uv run python -m app.scripts.invalidate_tenant_tokens <tenant_id>

Deliberately not an HTTP endpoint (see plan Part B.3) — invalidating every
refresh token for a whole company is an incident-response action, and giving
it a network-reachable path (even behind its own role/account) would be a
permanent extra attack surface for something that should require someone
already having shell access to the server.
"""

import asyncio
import sys
import uuid

from app.core.database import AsyncSessionLocal
from app.services.auth_service import revoke_all_tokens_for_tenant


async def main(tenant_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        count = await revoke_all_tokens_for_tenant(db, tenant_id)
    print(f"Revoked {count} active refresh token(s) for tenant {tenant_id}.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m app.scripts.invalidate_tenant_tokens <tenant_id>", file=sys.stderr)
        sys.exit(1)
    try:
        tenant_uuid = uuid.UUID(sys.argv[1])
    except ValueError:
        print(f"Invalid tenant_id: {sys.argv[1]!r} is not a UUID", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(tenant_uuid))
