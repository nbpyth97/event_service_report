"""add notifications

Revision ID: 0003_add_notifications
Revises: 0002_add_user_phone
Create Date: 2026-08-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0003_add_notifications'
down_revision: Union[str, None] = '0002_add_user_phone'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('notifications',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.UUID(), nullable=False),
    sa.Column('recipient_id', sa.UUID(), nullable=False),
    sa.Column('type', sa.String(length=30), nullable=False),
    sa.Column('agendamento_id', sa.UUID(), nullable=True),
    sa.Column('message', sa.String(length=500), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("type IN ('booking_pending', 'booking_cancelled')", name='ck_notifications_type'),
    sa.ForeignKeyConstraint(['agendamento_id'], ['agendamentos.id'], ),
    sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['tenant_id'], ['companies.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_tenant_id'), 'notifications', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_notifications_recipient_id'), 'notifications', ['recipient_id'], unique=False)
    op.create_index(
        'ix_notifications_tenant_id_recipient_id_created_at',
        'notifications', ['tenant_id', 'recipient_id', 'created_at'], unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_notifications_tenant_id_recipient_id_created_at', table_name='notifications')
    op.drop_index(op.f('ix_notifications_recipient_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_tenant_id'), table_name='notifications')
    op.drop_table('notifications')
