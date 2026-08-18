import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

NOTIFICATION_TYPES = ("booking_pending", "booking_cancelled")

# Initial value for Company.settings on registration — business_hours keys are
# Python's date.weekday() names (mon..sun), open/close in "HH:MM" 24h local time.
# A day mapped to None means closed. Mirrors the beauty-salon pilot tenant's
# real hours (tenants/anabela/config.json) as a sane default for any new company.
DEFAULT_COMPANY_SETTINGS = {
    "timezone": "Europe/Lisbon",
    # Not read by availability logic (slots are generated back-to-back by
    # service duration) — kept only as a future frontend display/grouping knob.
    "slot_interval_min": 15,
    "business_hours": {
        "mon": None,
        "tue": {"open": "08:00", "close": "19:00"},
        "wed": {"open": "08:00", "close": "19:00"},
        "thu": {"open": "08:00", "close": "19:00"},
        "fri": {"open": "08:00", "close": "19:00"},
        "sat": {"open": "08:00", "close": "19:00"},
        "sun": None,
    },
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="company")
    services: Mapped[list["Service"]] = relationship(back_populates="company")
    agendamentos: Mapped[list["Agendamento"]] = relationship(back_populates="company")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_users_tenant_id_name"),
        CheckConstraint("role IN ('admin', 'user')", name="ck_users_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    # Optional — set at registration, nothing backfills it for existing users.
    # Only consumer today is the admin's WhatsApp contact link on a booking
    # (app.core.models.Agendamento.customer_phone); no SMS/OTP flow yet.
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    company: Mapped["Company"] = relationship(back_populates="users")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")


class Customer(Base):
    """A booking identity with no login — phone is the business key (see
    uq_customers_tenant_id_phone): a booking from a known phone number always
    resolves to the same Customer row regardless of whether it came from the
    public anonymous booking page or an admin's manual appointment (see
    domains/customers/service.py::find_or_create_customer). Deliberately
    separate from User, which stays "staff who can log in" — see CLAUDE.md's
    Customer != User note."""

    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("tenant_id", "phone", name="uq_customers_tenant_id_phone"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    # 50, not 30: real phone numbers never need more than ~20, but the
    # migration backfill's fallback key for phone-less legacy users
    # ("legacy-" + a UUID) is 43 chars — see 0005_add_customers.py.
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    # Admin-set label for a customer they know by another name — independent
    # of, and never auto-overwritten by, the name the customer books under.
    alias: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Service(Base):
    __tablename__ = "services"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    duration_min: Mapped[int] = mapped_column(nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    company: Mapped["Company"] = relationship(back_populates="services")
    agendamentos: Mapped[list["Agendamento"]] = relationship(back_populates="service")


class Agendamento(Base):
    __tablename__ = "agendamentos"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'confirmed', 'declined', 'cancelled')", name="ck_agendamentos_status"),
        Index("ix_agendamentos_tenant_id_start_time", "tenant_id", "start_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    # Staff member who created this row via the admin manual-appointment flow
    # — NULL when the customer booked themselves through the public page.
    # Not the booking's identity (customer_id is) — purely an audit trail.
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    company: Mapped["Company"] = relationship(back_populates="agendamentos")
    service: Mapped["Service"] = relationship(back_populates="agendamentos")
    customer: Mapped["Customer"] = relationship()

    # Presentation-friendly accessors for the admin detail view — read from
    # already eager-loaded relationships (see agendamentos/repository.py's
    # _with_relations), never trigger a lazy load.
    @property
    def customer_name(self) -> str:
        return self.customer.name

    @property
    def customer_alias(self) -> str | None:
        return self.customer.alias

    @property
    def customer_phone(self) -> str | None:
        return self.customer.phone

    @property
    def service_name(self) -> str:
        return self.service.name

    @property
    def service_price(self) -> Decimal:
        return self.service.price

    @property
    def service_duration_min(self) -> int:
        return self.service.duration_min


class AgendamentoStatusHistory(Base):
    """One row per status transition (never per-creation — Agendamento.created_at
    already is the "pending" timestamp, so the API layer synthesizes that first
    timeline entry instead of duplicating it here). Written in the same
    transaction as the status mutation it records (see agendamentos/service.py
    update_status) — unlike the notification side effect, this is core domain
    data and should never exist without the state change it describes."""

    __tablename__ = "agendamento_status_history"
    __table_args__ = (
        Index("ix_agendamento_status_history_agendamento_id_changed_at", "agendamento_id", "changed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    agendamento_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agendamentos.id"), nullable=False)
    from_status: Mapped[str] = mapped_column(String(20), nullable=False)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint("type IN ('booking_pending', 'booking_cancelled')", name="ck_notifications_type"),
        Index("ix_notifications_tenant_id_recipient_id_created_at", "tenant_id", "recipient_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    agendamento_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agendamentos.id"), nullable=True
    )
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
