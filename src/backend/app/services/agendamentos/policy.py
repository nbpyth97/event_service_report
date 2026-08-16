# Pure business rules for Agendamento status transitions and who may trigger them.
# No FastAPI/DB imports on purpose — these are plain functions, not a service;
# service.py is responsible for turning a rejection into an HTTPException.

from app.core.enums import BookingStatus, UserRole

ALLOWED_TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    BookingStatus.PENDING: {BookingStatus.CONFIRMED, BookingStatus.DECLINED, BookingStatus.CANCELLED},
    BookingStatus.CONFIRMED: {BookingStatus.CANCELLED},
    BookingStatus.DECLINED: {BookingStatus.CANCELLED},
}


class InvalidStatusTransition(Exception):
    def __init__(self, current: BookingStatus, new: BookingStatus) -> None:
        self.current = current
        self.new = new
        super().__init__(f"Cannot change agendamento status from '{current.value}' to '{new.value}'")


def validate_transition(current: BookingStatus, new: BookingStatus) -> None:
    if new not in ALLOWED_TRANSITIONS.get(current, set()):
        raise InvalidStatusTransition(current, new)


def can_transition(*, role: UserRole, is_owner: bool, current: BookingStatus, new: BookingStatus) -> bool:
    """Who is allowed to attempt this transition (state legality is validate_transition's job).

    Admins manage all bookings for their company, gated only by ALLOWED_TRANSITIONS.
    Non-admin owners may additionally cancel their own booking, but only while pending —
    once an admin confirms or declines it, only the admin can cancel it.
    """
    if role == UserRole.ADMIN:
        return True
    return is_owner and current == BookingStatus.PENDING and new == BookingStatus.CANCELLED
