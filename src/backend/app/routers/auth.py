from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import clear_refresh_cookie, set_refresh_cookie, REFRESH_COOKIE_NAME
from app.core.database import get_db
from app.core.schemas import (
    AccessToken,
    AccessTokenWithUser,
    LoginPayload,
    RegisterCompanyOut,
    RegisterCompanyPayload,
)
from app.domains.auth import service as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register-company", response_model=RegisterCompanyOut, status_code=201)
async def register_company(payload: RegisterCompanyPayload, db: AsyncSession = Depends(get_db)):
    admin, company = await auth_service.register_company_and_admin(db, payload)
    return RegisterCompanyOut(id=admin.id, tenant_id=admin.tenant_id, name=admin.name, tenant_slug=company.slug)


@router.post("/login", response_model=AccessTokenWithUser)
async def login(payload: LoginPayload, response: Response, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate(db, payload)
    access_token, refresh_token = await auth_service.issue_tokens(db, user)
    set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "user": user}


@router.post("/refresh", response_model=AccessToken)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    access_token, new_refresh_token = await auth_service.rotate_refresh_token(db, refresh_token)
    set_refresh_cookie(response, new_refresh_token)
    return {"access_token": access_token}


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token:
        await auth_service.revoke_refresh_token(db, refresh_token)
    clear_refresh_cookie(response)
