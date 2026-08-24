import asyncio
import sys
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

if sys.platform == "win32":
    # asyncpg's connection-cancel-on-close path races with ProactorEventLoop
    # on Windows (harmless in the app itself — this only affects local test
    # runs; CI runs on Linux where this doesn't apply).
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def unique_slug() -> str:
    return f"test-{uuid.uuid4().hex[:12]}"
