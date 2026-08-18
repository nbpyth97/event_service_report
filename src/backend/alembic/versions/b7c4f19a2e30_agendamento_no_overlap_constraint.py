"""agendamento no-overlap exclusion constraint

Adds the database-level backstop for the one rule the service layer cannot
enforce alone: within a tenant, no two active bookings may overlap.

availability/service.py::is_slot_bookable already refuses to create one, but
it is a SELECT followed by an INSERT and those are not atomic. Under READ
COMMITTED (and REPEATABLE READ, which is snapshot isolation and equally blind
to phantoms) two concurrent requests can both observe a free slot and both
write it. The check has to happen inside the transaction that writes, which
only the database can do.

Kept as its own revision rather than folded into the squashed baseline: the
baseline has already been applied to running databases, so amending it would
never execute.

Revision ID: b7c4f19a2e30
Revises: ae301492d1f4
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op

revision: str = "b7c4f19a2e30"
down_revision: Union[str, None] = "ae301492d1f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # gist can't index a plain uuid for equality on its own — btree_gist adds
    # the operator classes that let tenant_id sit alongside the range column
    # in one exclusion constraint.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # tstzrange is '[)' by default, which is exactly _candidate_slots' overlap
    # rule (cursor < b_end and slot_end > b_start): touching endpoints do not
    # collide, so 09:00-09:30 and 09:30-10:00 remain legal neighbours.
    #
    # The WHERE clause is what makes declined/cancelled release their time —
    # they drop out of the index entirely, exactly as list_busy_intervals
    # ignores them.
    op.execute(
        """
        ALTER TABLE agendamentos
          ADD CONSTRAINT ex_agendamentos_no_overlap
          EXCLUDE USING gist (
            tenant_id                       WITH =,
            tstzrange(start_time, end_time) WITH &&
          ) WHERE (status IN ('pending', 'confirmed'))
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE agendamentos DROP CONSTRAINT ex_agendamentos_no_overlap")
    # btree_gist is left installed — other things may since depend on it, and
    # dropping an extension is not the business of this revision.
