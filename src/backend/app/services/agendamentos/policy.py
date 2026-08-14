# Pure business rule: which Agendamento.status transitions are allowed.
# No FastAPI/DB imports on purpose — this is a plain function, not a service;
# service.py is responsible for turning a rejection into an HTTPException.

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"confirmed", "declined"},
    "confirmed": {"cancelled"},
}


class InvalidStatusTransition(Exception):
    def __init__(self, current: str, new: str) -> None:
        self.current = current
        self.new = new
        super().__init__(f"Cannot change agendamento status from '{current}' to '{new}'")


def validate_transition(current: str, new: str) -> None:
    if new not in ALLOWED_TRANSITIONS.get(current, set()):
        raise InvalidStatusTransition(current, new)
