import pytest

from app.core.enums import BookingStatus
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
    ("is_owner", "new", "expected"),
    [
        # Owner may request cancelling their own booking — whether that's
        # currently legal (e.g. not already cancelled) is validate_transition's
        # job, not this check's, so `current` isn't even a parameter here.
        (True, BookingStatus.CANCELLED, True),
        # Non-owners may never trigger a transition.
        (False, BookingStatus.CANCELLED, False),
        # Owners can never confirm/decline a booking, even their own.
        (True, BookingStatus.CONFIRMED, False),
        (True, BookingStatus.DECLINED, False),
    ],
)
def test_can_transition(is_owner, new, expected):
    assert can_transition(is_owner=is_owner, new=new) is expected
