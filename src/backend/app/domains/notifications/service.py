import asyncio
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone

import asyncpg
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.models import Agendamento, Notification, User
from app.domains.notifications import repository
from app.domains.notifications.repository import NOTIFY_CHANNEL

logger = logging.getLogger(__name__)


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


async def _create_and_notify(
    db: AsyncSession, tenant_id: uuid.UUID, type_: str, agendamento_id: uuid.UUID, message: str
) -> None:
    """Best-effort: fan out one Notification row per admin plus a Postgres
    NOTIFY. Must never fail or roll back the caller's booking write."""
    try:
        admin_ids = await repository.list_admin_ids(db, tenant_id)
        notifications = [
            Notification(
                tenant_id=tenant_id,
                recipient_id=admin_id,
                type=type_,
                agendamento_id=agendamento_id,
                message=message,
            )
            for admin_id in admin_ids
        ]
        await repository.insert_many(db, notifications)
        await repository.notify_channel(db, tenant_id)
    except Exception:
        await db.rollback()
        logger.exception("Failed to create notifications for tenant %s", tenant_id)


async def notify_booking_pending(db: AsyncSession, tenant_id: uuid.UUID, agendamento: Agendamento) -> None:
    message = f"Novo agendamento pendente: {agendamento.customer_name} — {agendamento.service_name}"
    await _create_and_notify(db, tenant_id, "booking_pending", agendamento.id, message)


async def notify_booking_cancelled(db: AsyncSession, tenant_id: uuid.UUID, agendamento: Agendamento) -> None:
    message = f"Agendamento cancelado: {agendamento.customer_name} — {agendamento.service_name}"
    await _create_and_notify(db, tenant_id, "booking_cancelled", agendamento.id, message)


async def resolve_booking_pending(db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID) -> None:
    """Once a pending booking is confirmed/declined, the "new booking" alert
    that prompted it is no longer actionable — clear it for every admin
    instead of leaving a stale pending notification sitting in their inbox.
    Also pings the channel so any other admin's bell updates live, not just
    the one who made the change."""
    try:
        await repository.mark_unread_by_agendamento_read(db, tenant_id, agendamento_id, "booking_pending", utcnow())
        await repository.notify_channel(db, tenant_id)
    except Exception:
        await db.rollback()
        logger.exception("Failed to resolve booking_pending notifications for agendamento %s", agendamento_id)


async def list_notifications(db: AsyncSession, current_user: User) -> list[Notification]:
    # Unread-only: this is an actionable inbox, not a history log. Marking a
    # notification read is how it leaves the list, so there's no unbounded
    # growth to paginate against — an admin's unread count stays small as
    # bookings get resolved.
    return await repository.list_unread(db, current_user.tenant_id, current_user.id)


async def mark_read(db: AsyncSession, current_user: User, notification_id: uuid.UUID) -> Notification:
    notification = await repository.fetch_by_id(db, current_user.tenant_id, current_user.id, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = utcnow()
        await repository.save(db, notification)
    return notification
