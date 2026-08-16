import pytest

from app.core.enums import BookingStatus, UserRole
from app.services.agendamentos.policy import (
    ALLOWED_TRANSITIONS,
    InvalidStatusTransition,
    can_transition,
    validate_transition,
)

# Every state that appears anywhere in ALLOWED_TRANSITIONS (as a source or a target).
ALL_STATUSES = set(BookingStatus)


@pytest.mark.parametrize(
    ("current", "new"),
    [
        (BookingStatus.PENDING, BookingStatus.CONFIRMED),
        (BookingStatus.PENDING, BookingStatus.DECLINED),
        (BookingStatus.PENDING, BookingStatus.CANCELLED),
        (BookingStatus.CONFIRMED, BookingStatus.CANCELLED),
        (BookingStatus.DECLINED, BookingStatus.CANCELLED),
    ],
)
def test_allowed_transitions_pass(current, new):
    validate_transition(current, new)  # must not raise


@pytest.mark.parametrize(
    ("current", "new"),
    [
        (current, new)
        for current in ALL_STATUSES
        for new in ALL_STATUSES
        if new not in ALLOWED_TRANSITIONS.get(current, set())
    ],
)
def test_disallowed_transitions_raise(current, new):
    with pytest.raises(InvalidStatusTransition):
        validate_transition(current, new)


def test_allowed_transitions_shape_is_pinned():
    # Pins the exact rule set. If this test breaks, the change to
    # ALLOWED_TRANSITIONS was intentional and this assertion (plus the
    # router/service tests) must be updated deliberately, not silently.
    assert ALLOWED_TRANSITIONS == {
        BookingStatus.PENDING: {BookingStatus.CONFIRMED, BookingStatus.DECLINED, BookingStatus.CANCELLED},
        BookingStatus.CONFIRMED: {BookingStatus.CANCELLED},
        BookingStatus.DECLINED: {BookingStatus.CANCELLED},
    }


def test_invalid_status_transition_message_includes_states():
    exc = InvalidStatusTransition(BookingStatus.DECLINED, BookingStatus.CONFIRMED)
    assert "declined" in str(exc)
    assert "confirmed" in str(exc)


@pytest.mark.parametrize(
    ("role", "is_owner", "current", "new", "expected"),
    [
        # Admins are only constrained by ALLOWED_TRANSITIONS (checked separately by service.py).
        (UserRole.ADMIN, False, BookingStatus.PENDING, BookingStatus.CONFIRMED, True),
        (UserRole.ADMIN, False, BookingStatus.CONFIRMED, BookingStatus.CANCELLED, True),
        (UserRole.ADMIN, False, BookingStatus.DECLINED, BookingStatus.CANCELLED, True),
        # Owner may cancel their own booking only while pending.
        (UserRole.USER, True, BookingStatus.PENDING, BookingStatus.CANCELLED, True),
        (UserRole.USER, True, BookingStatus.CONFIRMED, BookingStatus.CANCELLED, False),
        (UserRole.USER, True, BookingStatus.DECLINED, BookingStatus.CANCELLED, False),
        # Non-owner users may never trigger a transition, regardless of status.
        (UserRole.USER, False, BookingStatus.PENDING, BookingStatus.CANCELLED, False),
        # Users can never confirm/decline a booking, even their own.
        (UserRole.USER, True, BookingStatus.PENDING, BookingStatus.CONFIRMED, False),
    ],
)
def test_can_transition(role, is_owner, current, new, expected):
    assert can_transition(role=role, is_owner=is_owner, current=current, new=new) is expected
