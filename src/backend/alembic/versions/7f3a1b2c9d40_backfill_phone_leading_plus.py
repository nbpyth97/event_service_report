"""backfill customers.phone with a leading '+'

Phone storage moves from a digit-only convention to canonical E.164
("+<country code><national number>") now that phone parsing/validation goes
through the `phonenumbers` library (see core/phone.py::to_e164,
core/schemas.py's CustomerCreate/CustomerUpdate/PublicBookingCreate). Every
number already stored under the old convention is, by construction, digits
only — this is a one-time, one-way backfill on dev data (no real customers
exist yet); the guard (`~ '^[0-9]+$'`) makes it a no-op, not an error, if run
again or against a row that already has a leading '+'.

Revision ID: 7f3a1b2c9d40
Revises: 26bc23f929a5
Create Date: 2026-08-21

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7f3a1b2c9d40'
down_revision: Union[str, None] = '26bc23f929a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE customers SET phone = '+' || phone WHERE phone ~ '^[0-9]+$'")


def downgrade() -> None:
    op.execute(r"UPDATE customers SET phone = substring(phone from 2) WHERE phone ~ '^\+'")
