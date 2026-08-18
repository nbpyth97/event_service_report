import re
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import BookingStatus, UserRole

# Portugal-only (single pilot tenant): 351 country code + 9-digit mobile =
# 12 digits, not E.164's generic 15. Frontend-only validation doesn't mean
# anything on the public booking endpoint — it's unauthenticated, so this is
# the actual enforcement, not just UX polish (see lib/format.ts::
# validatePhoneDigits for the matching frontend rule).
_MIN_PHONE_DIGITS = 9
_MAX_PHONE_DIGITS = 12


def _validate_phone_digits(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if not (_MIN_PHONE_DIGITS <= len(digits) <= _MAX_PHONE_DIGITS):
        raise ValueError(f"Phone number must have between {_MIN_PHONE_DIGITS} and {_MAX_PHONE_DIGITS} digits")
    return value


class RegisterCompanyPayload(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    admin_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8, max_length=200)


class LoginPayload(BaseModel):
    tenant_slug: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    role: UserRole


class RegisterCompanyOut(UserOut):
    # The only way an admin (or a test) learns the auto-generated slug they'll
    # need to log in — see auth/service.py::register_company_and_admin.
    tenant_slug: str


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
    customer_id: uuid.UUID


class AgendamentoStatusUpdate(BaseModel):
    status: BookingStatus


class AgendamentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    service_id: uuid.UUID
    customer_id: uuid.UUID
    created_by: uuid.UUID | None
    start_time: datetime
    end_time: datetime
    status: BookingStatus
    customer_name: str
    customer_alias: str | None
    customer_phone: str | None
    service_name: str
    service_price: Decimal
    service_duration_min: int


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    alias: str | None


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=30)

    _validate_phone = field_validator("phone")(_validate_phone_digits)


class CustomerAliasUpdate(BaseModel):
    alias: str | None = Field(default=None, max_length=150)


class PublicCompanyOut(BaseModel):
    # Not from_attributes — business_hours lives nested inside Company.settings
    # (JSONB), not as a plain attribute, so routers/public.py builds this
    # explicitly. Deliberately narrower than CompanyOut (no id/slug/full
    # settings) but still needs business_hours: the public booking page's
    # date picker greys out closed days the same way the authenticated one does.
    name: str
    business_hours: dict


class PublicBookingCreate(BaseModel):
    service_id: uuid.UUID
    start_time: datetime
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=30)

    _validate_phone = field_validator("phone")(_validate_phone_digits)


class AgendamentoStatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_status: BookingStatus | None
    to_status: BookingStatus
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
