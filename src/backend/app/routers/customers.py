import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.models import User
from app.core.schemas import CustomerCreate, CustomerOut, CustomerUpdate
from app.domains.customers import service as customers_service

# Staff-only, like every authenticated router — the customer directory has no
# customer-facing counterpart (see routers/public.py for what a customer can
# reach without a login).
router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
async def list_customers(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await customers_service.list_customers(db, current_user.tenant_id)


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(
    payload: CustomerCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Same find-or-create-by-phone as the public booking path (see
    domains/customers/service.py) — an admin adding a "new" customer who
    already booked once themselves resolves to that same Customer row."""
    return await customers_service.find_or_create_customer(
        db, current_user.tenant_id, payload.customer_known_name, payload.phone, payload.country
    )


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await customers_service.update_customer(
        db, current_user.tenant_id, customer_id, payload.customer_known_name, payload.phone, payload.country
    )
