import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RegisterCompanyPayload(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    company_slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    admin_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8, max_length=200)


class RegisterCustomerPayload(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8, max_length=200)
    phone: str | None = Field(default=None, max_length=30)


class LoginPayload(BaseModel):
    tenant_slug: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    role: str


class AccessToken(BaseModel):
    access_token: str


class AccessTokenWithUser(AccessToken):
    user: UserOut


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: Decimal = Field(ge=0, decimal_places=2)
    duration_min: int = Field(ge=1)


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    price: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    duration_min: int | None = Field(default=None, ge=1)
    active: bool | None = None


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    price: Decimal
    duration_min: int
    active: bool
    created_by: uuid.UUID


class AgendamentoCreate(BaseModel):
    service_id: uuid.UUID
    start_time: datetime


class AgendamentoStatusUpdate(BaseModel):
    status: str = Field(pattern="^(confirmed|declined|cancelled)$")


class AgendamentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    service_id: uuid.UUID
    created_by: uuid.UUID
    start_time: datetime
    end_time: datetime
    status: str
    customer_name: str
    customer_phone: str | None
    service_name: str
    service_price: Decimal
    service_duration_min: int


class AgendamentoStatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_status: str | None
    to_status: str
    changed_at: datetime


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    settings: dict


class AvailabilityOut(BaseModel):
    slots: list[datetime]


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    type: str
    agendamento_id: uuid.UUID | None
    message: str
    read_at: datetime | None
    created_at: datetime
