"""strip leading '+' from customers.phone

normalize_phone used to keep-or-drop '+' depending on whatever the caller
typed, so "+351929349996" and "351929349996" landed as two different stored
values for the same real number and silently split one customer into two
rows with two independent booking histories. normalize_phone now always
strips to bare digits (no '+') going forward — this backfills existing rows
to match, so every phone in the table is in the one canonical form.

Revision ID: e7b3c9a1f4d2
Revises: d4a19f6e2b7c
Create Date: 2026-08-21

"""
from typing import Sequence, Union

from alembic import op

revision: str = "e7b3c9a1f4d2"
down_revision: Union[str, None] = "d4a19f6e2b7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(r"UPDATE customers SET phone = regexp_replace(phone, '\D', '', 'g')")


def downgrade() -> None:
    # The '+' isn't recoverable from bare digits alone (some rows never had
    # one) — nothing to reverse to.
    pass
