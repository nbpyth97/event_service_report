# Pure business rules for Agendamento status transitions and who may trigger them.
# No FastAPI/DB imports on purpose — these are plain functions, not a service;
# service.py is responsible for turning a rejection into an HTTPException.

from app.core.enums import BookingStatus

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


def can_transition(*, is_owner: bool, new: BookingStatus) -> bool:
    """Whether a non-admin owner may attempt this transition — they may only ever
    request cancelling their own booking. Whether that's currently legal (e.g. it
    isn't already cancelled) is validate_transition's job, not this check's — admins
    go through that same legality check unconditionally, with no extra restriction
    here at all.
    """
    return is_owner and new == BookingStatus.CANCELLED
