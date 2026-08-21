"""collapse customers.name/alias into customer_known_name

There is no customer login, so nothing ever verified the phone number a
booking arrived with — anyone typing a known phone could silently overwrite
that customer's stored name on their next booking (the old upsert was
ON CONFLICT DO UPDATE SET name = ...). Phone is the real business key
(uq_customers_tenant_id_phone); name is now written once, on first insert,
and thereafter only changeable by staff (PUT /api/customers/{id}). That
collapses the old two-field name/alias display (alias ?? name) into one
column, preferring the alias where one was set since it was the value staff
had already chosen to see.

Revision ID: d4a19f6e2b7c
Revises: b7c4f19a2e30
Create Date: 2026-08-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4a19f6e2b7c"
down_revision: Union[str, None] = "b7c4f19a2e30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Preserve the staff-chosen display value: where an alias was set, it was
    # already what the UI showed in place of name (`alias ?? name`).
    op.execute("UPDATE customers SET name = alias WHERE alias IS NOT NULL")
    op.alter_column("customers", "name", new_column_name="customer_known_name")
    op.drop_column("customers", "alias")


def downgrade() -> None:
    op.add_column("customers", sa.Column("alias", sa.String(length=150), nullable=True))
    op.alter_column("customers", "customer_known_name", new_column_name="name")
