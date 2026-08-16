import uuid

import pytest
from fastapi import HTTPException

from app.core.database import AsyncSessionLocal
from app.services.companies.service import get_company


async def test_get_company_unknown_tenant_raises_404():
    async with AsyncSessionLocal() as db:
        with pytest.raises(HTTPException) as exc_info:
            await get_company(db, uuid.uuid4())
    assert exc_info.value.status_code == 404
