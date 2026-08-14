import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.models import Agendamento


def _with_relations(stmt):
    # AgendamentoOut.customer_name/service_name/etc read these off the ORM
    # object — eager-load so they never trigger a lazy load on an async session.
    return stmt.options(selectinload(Agendamento.service), selectinload(Agendamento.creator))


async def fetch_by_id(db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID) -> Agendamento | None:
    stmt = _with_relations(select(Agendamento)).where(
        Agendamento.id == agendamento_id, Agendamento.tenant_id == tenant_id
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_for_tenant(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID | None = None
) -> list[Agendamento]:
    stmt = _with_relations(select(Agendamento)).where(Agendamento.tenant_id == tenant_id)
    if created_by is not None:
        stmt = stmt.where(Agendamento.created_by == created_by)
    stmt = stmt.order_by(Agendamento.start_time)
    return list((await db.execute(stmt)).scalars().all())


async def insert(db: AsyncSession, agendamento: Agendamento) -> None:
    db.add(agendamento)
    await db.commit()


async def save(db: AsyncSession) -> None:
    await db.commit()
