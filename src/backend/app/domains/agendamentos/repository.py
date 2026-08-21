import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.models import Agendamento, AgendamentoStatusHistory


def _with_relations(stmt):
    # AgendamentoOut.customer_name/service_name/etc read these off the ORM
    # object — eager-load so they never trigger a lazy load on an async session.
    return stmt.options(selectinload(Agendamento.service), selectinload(Agendamento.customer))


async def fetch_by_id(db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID) -> Agendamento | None:
    stmt = _with_relations(select(Agendamento)).where(
        Agendamento.id == agendamento_id, Agendamento.tenant_id == tenant_id
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_for_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Agendamento]:
    stmt = (
        _with_relations(select(Agendamento))
        .where(Agendamento.tenant_id == tenant_id)
        .order_by(Agendamento.start_time)
    )
    return list((await db.execute(stmt)).scalars().all())


async def insert(db: AsyncSession, agendamento: Agendamento) -> None:
    db.add(agendamento)
    await db.commit()


async def save(db: AsyncSession, history: AgendamentoStatusHistory) -> None:
    """Commits the caller's already-mutated Agendamento together with its
    status-history row, in one transaction — the history entry should never
    exist without the state change it describes, or vice versa."""
    db.add(history)
    await db.commit()


async def mark_notified(db: AsyncSession, agendamento: Agendamento, notified_at: datetime) -> None:
    agendamento.notified_at = notified_at
    await db.commit()


async def list_status_history(
    db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID
) -> list[AgendamentoStatusHistory]:
    stmt = (
        select(AgendamentoStatusHistory)
        .where(
            AgendamentoStatusHistory.agendamento_id == agendamento_id,
            AgendamentoStatusHistory.tenant_id == tenant_id,
        )
        .order_by(AgendamentoStatusHistory.changed_at)
    )
    return list((await db.execute(stmt)).scalars().all())
