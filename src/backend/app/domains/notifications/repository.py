import uuid
from datetime import datetime

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Notification, User

NOTIFY_CHANNEL = "notifications_channel"


async def list_staff_ids(db: AsyncSession, tenant_id: uuid.UUID) -> list[uuid.UUID]:
    """Every User in the tenant — a User is staff by definition now that
    Customer owns booking identity (see core/models.py::User)."""
    stmt = select(User.id).where(User.tenant_id == tenant_id)
    return list((await db.execute(stmt)).scalars().all())


async def insert_many(db: AsyncSession, notifications: list[Notification]) -> None:
    for notification in notifications:
        db.add(notification)
    await db.commit()


async def notify_channel(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    await db.execute(text("SELECT pg_notify(:channel, :tenant_id)"), {"channel": NOTIFY_CHANNEL, "tenant_id": str(tenant_id)})
    await db.commit()


async def list_unread(db: AsyncSession, tenant_id: uuid.UUID, recipient_id: uuid.UUID) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(
            Notification.tenant_id == tenant_id,
            Notification.recipient_id == recipient_id,
            Notification.read_at.is_(None),
        )
        .order_by(Notification.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def fetch_by_id(
    db: AsyncSession, tenant_id: uuid.UUID, recipient_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification | None:
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.tenant_id == tenant_id,
        Notification.recipient_id == recipient_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def save(db: AsyncSession, notification: Notification) -> None:
    await db.commit()
    await db.refresh(notification)


async def mark_unread_by_agendamento_read(
    db: AsyncSession, tenant_id: uuid.UUID, agendamento_id: uuid.UUID, type_: str, read_at: datetime
) -> None:
    stmt = (
        update(Notification)
        .where(
            Notification.tenant_id == tenant_id,
            Notification.agendamento_id == agendamento_id,
            Notification.type == type_,
            Notification.read_at.is_(None),
        )
        .values(read_at=read_at)
    )
    await db.execute(stmt)
    await db.commit()
