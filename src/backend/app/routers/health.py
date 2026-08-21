from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/health/live")
async def health_live() -> dict:
    """Is the FastAPI process alive? No dependency checks."""
    return {"status": "ok"}


@router.get("/health/ready")
async def health_ready(db: AsyncSession = Depends(get_db)) -> dict:
    """Can this application actually use its dependencies?"""
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}
