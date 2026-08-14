"""add agendamento status history

Revision ID: 0004_add_agendamento_history
Revises: 0003_add_notifications
Create Date: 2026-08-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_add_agendamento_history'
down_revision: Union[str, None] = '0003_add_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('agendamento_status_history',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.UUID(), nullable=False),
    sa.Column('agendamento_id', sa.UUID(), nullable=False),
    sa.Column('from_status', sa.String(length=20), nullable=False),
    sa.Column('to_status', sa.String(length=20), nullable=False),
    sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['agendamento_id'], ['agendamentos.id'], ),
    sa.ForeignKeyConstraint(['tenant_id'], ['companies.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_agendamento_status_history_tenant_id'), 'agendamento_status_history', ['tenant_id'], unique=False)
    op.create_index(
        'ix_agendamento_status_history_agendamento_id_changed_at',
        'agendamento_status_history', ['agendamento_id', 'changed_at'], unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_agendamento_status_history_agendamento_id_changed_at', table_name='agendamento_status_history')
    op.drop_index(op.f('ix_agendamento_status_history_tenant_id'), table_name='agendamento_status_history')
    op.drop_table('agendamento_status_history')
