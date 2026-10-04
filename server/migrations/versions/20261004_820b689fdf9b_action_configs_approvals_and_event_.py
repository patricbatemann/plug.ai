"""action configs approvals and event cycles

Revision ID: 820b689fdf9b
Revises: a92db01cb9d2
Create Date: 2026-10-04 15:47:08.456226

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '820b689fdf9b'
down_revision: Union[str, Sequence[str], None] = 'a92db01cb9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('action', 'status', type_=sa.String(length=24))
    op.create_table('action_config',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('asset_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('current', sa.Boolean(), nullable=False),
    sa.Column('autonomy', sa.String(length=16), nullable=False),
    sa.Column('limits', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('approval', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.CheckConstraint("autonomy IN ('auto', 'approval', 'recommend')", name='action_config_autonomy'),
    sa.CheckConstraint("kind IN ('battery_charge', 'battery_discharge', 'curtail', 'demand_response', 'load_shift', 'grid_import', 'grid_export')", name='action_config_kind'),
    sa.CheckConstraint("status IN ('draft', 'testing', 'active', 'paused')", name='action_config_status'),
    sa.ForeignKeyConstraint(['asset_id'], ['asset.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['site_id'], ['site.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_action_config_asset_id'), 'action_config', ['asset_id'], unique=False)
    op.create_index('uq_action_config_current', 'action_config', ['asset_id', 'kind'], unique=True,
                    postgresql_where=sa.text('current'))
    op.add_column('action', sa.Column('tier', sa.String(length=16), server_default='auto', nullable=False))
    op.add_column('action', sa.Column('deadline_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('action', sa.Column('decided_by', sa.String(length=320), nullable=True))
    op.add_column('action', sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('cycle', sa.Column('trigger_detail', sa.String(length=200), server_default='', nullable=False))
    op.add_column('portfolio', sa.Column('protected', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM run")  # demo runs are disposable; their statuses may not fit
    op.alter_column('action', 'status', type_=sa.String(length=16))
    op.drop_column('portfolio', 'protected')
    op.drop_column('cycle', 'trigger_detail')
    op.drop_column('action', 'decided_at')
    op.drop_column('action', 'decided_by')
    op.drop_column('action', 'deadline_at')
    op.drop_column('action', 'tier')
    op.drop_index(op.f('ix_action_config_asset_id'), table_name='action_config')
    op.drop_table('action_config')
