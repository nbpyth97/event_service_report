import re
import uuid
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo, available_timezones

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.enums import BookingStatus
from app.core.phone import DEFAULT_REGION

# `phone` here is the raw, as-typed string — this layer only carries it and
# its `country` alongside each other over the wire; it does not parse or
# validate it. Turning (phone, country) into a canonical E.164 value is a
# business rule (which numbering plan applies, whether "+" wins over the
# selected country, what counts as valid), not a wire-format concern, so it
# lives in domains/customers/service.py::normalize_phone (core/phone.py's
# to_e164), not here.


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
    notified_at: datetime | None
    notes: str | None
    customer_name: str
    customer_known_name: str
    customer_phone: str | None
    service_name: str
    service_price: Decimal
    service_duration_min: int


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_known_name: str
    phone: str


class CustomerCreate(BaseModel):
    customer_known_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=30)
    country: str = Field(default=DEFAULT_REGION, min_length=2, max_length=2)


class CustomerUpdate(BaseModel):
    customer_known_name: str = Field(min_length=1, max_length=150)
    # Optional — staff correcting a wrong number after the fact. Omitted (or
    # None) means "leave the phone alone"; the column itself is never
    # nullable, so None can't mean "clear it".
    phone: str | None = Field(default=None, min_length=1, max_length=30)
    country: str = Field(default=DEFAULT_REGION, min_length=2, max_length=2)


class PublicCompanyOut(BaseModel):
    # Not from_attributes — business_hours lives nested inside Company.settings
    # (JSONB), not as a plain attribute, so routers/public.py builds this
    # explicitly. Deliberately narrower than CompanyOut (no id/slug/full
    # settings) but still needs business_hours: the public booking page's
    # date picker greys out closed days the same way the authenticated one does,
    # and timezone so slot times render in the salon's local frame rather than
    # whatever zone the visitor's browser happens to be in.
    name: str
    business_hours: dict
    timezone: str


class PublicBookingCreate(BaseModel):
    service_id: uuid.UUID
    start_time: datetime
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=30)
    country: str = Field(default=DEFAULT_REGION, min_length=2, max_length=2)
    notes: str | None = Field(default=None, max_length=500)


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
    # Read-only on the settings page ("Data de criação"), alongside slug —
    # neither is editable, since the slug is baked into every public booking
    # link already shared with customers.
    created_at: datetime


_HHMM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

# date.weekday() order, matching DEFAULT_COMPANY_SETTINGS and
# availability/service.py::DOW_KEYS.
_DOW_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class DayHoursIn(BaseModel):
    """One weekday's opening window. `None` in place of this object means the
    company is closed that day — see BusinessHoursIn below."""

    model_config = ConfigDict(extra="forbid")

    open: str
    close: str

    @field_validator("open", "close")
    @classmethod
    def _hhmm(cls, value: str) -> str:
        if not _HHMM_RE.match(value):
            raise ValueError("Hora deve estar no formato HH:MM (24 horas)")
        return value

    @model_validator(mode="after")
    def _open_before_close(self) -> "DayHoursIn":
        if self.open >= self.close:
            raise ValueError("A hora de abertura deve ser anterior à de fecho")
        return self


class CompanySettingsUpdate(BaseModel):
    """Partial patch of Company.settings. Every field is optional, but a field
    that *is* sent may not be null (see _reject_explicit_nulls) — the JSONB blob
    is merged key-by-key in companies/service.py, so omitting a key keeps it."""

    model_config = ConfigDict(extra="forbid")

    timezone: str | None = None
    # Bounded rather than free: the availability grid walks a whole business
    # day one step at a time, and a 0/negative step would never terminate
    # while a 1-minute step would emit hundreds of candidate slots.
    slot_interval_min: int | None = Field(default=None, ge=5, le=120)
    # All seven keys required together — a partial map would silently leave the
    # missing days at their old hours while looking like a full replacement.
    business_hours: dict[str, DayHoursIn | None] | None = None

    @field_validator("timezone")
    @classmethod
    def _known_zone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if value not in available_timezones():
            raise ValueError("Fuso horário inválido")
        ZoneInfo(value)  # cheap sanity check that the tzdata entry really loads
        return value

    @field_validator("business_hours")
    @classmethod
    def _all_weekdays(cls, value: dict | None) -> dict | None:
        if value is None:
            return value
        if set(value) != set(_DOW_KEYS):
            raise ValueError("business_hours deve conter exatamente os dias mon, tue, wed, thu, fri, sat, sun")
        return value

    @model_validator(mode="after")
    def _reject_explicit_nulls(self) -> "CompanySettingsUpdate":
        return _reject_explicit_nulls(self)


class CompanyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    settings: CompanySettingsUpdate | None = None

    @model_validator(mode="after")
    def _reject_explicit_nulls(self) -> "CompanyUpdate":
        return _reject_explicit_nulls(self)


def _reject_explicit_nulls(model: BaseModel) -> BaseModel:
    """`None` is how these schemas spell "not sent", and the service layer keys
    off model_fields_set to decide what to merge. An explicit `null` in the JSON
    body would therefore be silently ignored rather than clearing anything —
    reject it instead of pretending the write happened."""
    for field in model.model_fields_set:
        if getattr(model, field) is None:
            raise ValueError(f"O campo '{field}' não pode ser nulo")
    return model


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
