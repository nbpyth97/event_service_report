import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_token, get_current_user
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.models import User
from app.core.schemas import NotificationOut
from app.domains.notifications import service as notifications_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

SSE_HEARTBEAT_SECONDS = 15


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await notifications_service.list_notifications(db, current_user)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notifications_service.mark_read(db, current_user, notification_id)


async def _get_sse_user(token: str, db: AsyncSession) -> User:
    # EventSource can't set an Authorization header, so the stream endpoint
    # takes the access token as a query param instead of the bearer flow
    # every other route uses.
    payload = decode_token(token, "access")
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user


@router.get("/stream")
async def stream_notifications(request: Request, token: str, db: AsyncSession = Depends(get_db)):
    user = await _get_sse_user(token, db)
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Privilégios de administrador necessários")

    tenant_id = user.tenant_id

    async def event_generator():
        queue = notifications_service.hub.subscribe(tenant_id)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    await asyncio.wait_for(queue.get(), timeout=SSE_HEARTBEAT_SECONDS)
                    yield "event: notification\ndata: update\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            notifications_service.hub.unsubscribe(tenant_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
