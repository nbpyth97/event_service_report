import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Agendamento


async def list_busy_intervals(
    db: AsyncSession, tenant_id: uuid.UUID, open_dt: datetime, close_dt: datetime
) -> list[tuple[datetime, datetime]]:
    stmt = select(Agendamento).where(
        Agendamento.tenant_id == tenant_id,
        Agendamento.status.in_(("pending", "confirmed")),
        Agendamento.start_time < close_dt,
        Agendamento.end_time > open_dt,
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [(a.start_time, a.end_time) for a in rows]
