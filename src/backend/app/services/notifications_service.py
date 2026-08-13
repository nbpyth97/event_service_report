import asyncio
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone

import asyncpg
from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.models import Agendamento, Notification, User

logger = logging.getLogger(__name__)

NOTIFY_CHANNEL = "notifications_channel"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NotificationHub:
    """In-process fan-out from this backend instance's single asyncpg LISTEN
    connection to its locally-connected SSE clients. Each instance only
    dispatches to its own clients — Postgres NOTIFY reaches every instance
    independently, so this works unchanged under single- or multi-instance
    deployment without a Redis dependency."""

    def __init__(self) -> None:
        self._subscribers: dict[uuid.UUID, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, tenant_id: uuid.UUID) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[tenant_id].add(queue)
        return queue

    def unsubscribe(self, tenant_id: uuid.UUID, queue: asyncio.Queue) -> None:
        self._subscribers[tenant_id].discard(queue)
        if not self._subscribers[tenant_id]:
            del self._subscribers[tenant_id]

    def publish(self, tenant_id: uuid.UUID) -> None:
        for queue in self._subscribers.get(tenant_id, ()):
            queue.put_nowait(None)


hub = NotificationHub()


async def listen_for_notifications() -> asyncpg.Connection:
    conn = await asyncpg.connect(
        user=settings.postgres_user,
        password=settings.postgres_password,
        database=settings.postgres_db,
        host=settings.postgres_host,
        port=settings.postgres_port,
    )

    def _on_notify(connection: asyncpg.Connection, pid: int, channel: str, payload: str) -> None:
        hub.publish(uuid.UUID(payload))

    await conn.add_listener(NOTIFY_CHANNEL, _on_notify)
    return conn


async def _admin_ids(db: AsyncSession, tenant_id: uuid.UUID) -> list[uuid.UUID]:
    stmt = select(User.id).where(User.tenant_id == tenant_id, User.role == "admin")
    return list((await db.execute(stmt)).scalars().all())


async def _create_and_notify(
    db: AsyncSession, tenant_id: uuid.UUID, type_: str, agendamento_id: uuid.UUID, message: str
) -> None:
    """Best-effort: fan out one Notification row per admin plus a Postgres
    NOTIFY. Must never fail or roll back the caller's booking write."""
    try:
        admin_ids = await _admin_ids(db, tenant_id)
        for admin_id in admin_ids:
            db.add(
                Notification(
                    tenant_id=tenant_id,
                    recipient_id=admin_id,
                    type=type_,
                    agendamento_id=agendamento_id,
                    message=message,
                )
            )
        await db.commit()
        await db.execute(
            text("SELECT pg_notify(:channel, :tenant_id)"), {"channel": NOTIFY_CHANNEL, "tenant_id": str(tenant_id)}
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Failed to create notifications for tenant %s", tenant_id)


async def notify_booking_pending(db: AsyncSession, tenant_id: uuid.UUID, agendamento: Agendamento) -> None:
    message = f"Novo agendamento pendente: {agendamento.customer_name} — {agendamento.service_name}"
    await _create_and_notify(db, tenant_id, "booking_pending", agendamento.id, message)


async def notify_booking_cancelled(db: AsyncSession, tenant_id: uuid.UUID, agendamento: Agendamento) -> None:
    message = f"Agendamento cancelado: {agendamento.customer_name} — {agendamento.service_name}"
    await _create_and_notify(db, tenant_id, "booking_cancelled", agendamento.id, message)


async def list_notifications(db: AsyncSession, current_user: User) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.tenant_id == current_user.tenant_id, Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def mark_read(db: AsyncSession, current_user: User, notification_id: uuid.UUID) -> Notification:
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.tenant_id == current_user.tenant_id,
        Notification.recipient_id == current_user.id,
    )
    notification = (await db.execute(stmt)).scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = utcnow()
        await db.commit()
        await db.refresh(notification)
    return notification
