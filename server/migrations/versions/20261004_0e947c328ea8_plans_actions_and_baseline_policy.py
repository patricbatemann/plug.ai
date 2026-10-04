"""plans actions and baseline policy

Simulation runs are disposable demo data: existing runs are deleted so the new
required columns need no backfill.

Revision ID: 0e947c328ea8
Revises: 131a02014e71
Create Date: 2026-10-04 15:11:13.464343

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.sim.market import DEFAULT_MARKET

# revision identifiers, used by Alembic.
revision: str = '0e947c328ea8'
down_revision: Union[str, Sequence[str], None] = '131a02014e71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

KEYS = {'asset_block': ['block', 'asset_id'], 'system_block': ['block'], 'line_block': ['block', 'line_id']}


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DELETE FROM run")
    op.create_table('cycle',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('block', sa.Integer(), nullable=False),
    sa.Column('seq', sa.Integer(), nullable=False),
    sa.Column('trigger', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('timings', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('run_id', 'block', 'seq')
    )
    op.create_table('action',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('policy', sa.String(length=16), nullable=False),
    sa.Column('cycle_id', sa.Integer(), nullable=True),
    sa.Column('block', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('asset_id', sa.Integer(), nullable=True),
    sa.Column('mw', sa.Float(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('reason', sa.String(length=200), nullable=True),
    sa.Column('idempotency_key', sa.String(length=80), nullable=False),
    sa.Column('delivered_mw', sa.Float(), nullable=True),
    sa.Column('actual_mw', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['asset_id'], ['asset.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['cycle_id'], ['cycle.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('idempotency_key')
    )
    op.create_index('ix_action_run_block', 'action', ['run_id', 'policy', 'block'], unique=False)
    op.create_table('plan',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('cycle_id', sa.Integer(), nullable=False),
    sa.Column('variant', sa.String(length=16), nullable=False),
    sa.Column('role', sa.String(length=16), nullable=False),
    sa.Column('kpis', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('schedule', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('solver', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.ForeignKeyConstraint(['cycle_id'], ['cycle.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_plan_cycle_id'), 'plan', ['cycle_id'], unique=False)
    op.add_column('asset_block', sa.Column('policy', sa.String(length=16), nullable=False))
    op.add_column('line_block', sa.Column('policy', sa.String(length=16), nullable=False))
    op.add_column('portfolio', sa.Column('market', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                                         server_default=sa.text("'" + json.dumps(DEFAULT_MARKET) + "'::jsonb")))
    op.alter_column('portfolio', 'market', server_default=None)
    op.add_column('run', sa.Column('dam_schedule', sa.ARRAY(sa.Float()), nullable=False))
    op.add_column('system_block', sa.Column('policy', sa.String(length=16), nullable=False))
    op.add_column('system_block', sa.Column('schedule_mw', sa.Float(), nullable=False))
    op.add_column('system_block', sa.Column('deviation_mw', sa.Float(), nullable=False))
    op.add_column('system_block', sa.Column('market_inr', sa.Float(), nullable=False))
    op.add_column('system_block', sa.Column('dsm_inr', sa.Float(), nullable=False))
    op.add_column('system_block', sa.Column('dr_inr', sa.Float(), nullable=False))
    op.add_column('system_block', sa.Column('wear_inr', sa.Float(), nullable=False))
    op.add_column('system_block', sa.Column('curtail_inr', sa.Float(), nullable=False))
    for table, keys in KEYS.items():
        op.drop_constraint(f'{table}_pkey', table, type_='primary')
        op.create_primary_key(f'{table}_pkey', table, ['run_id', 'policy', *keys])


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM run")
    for table, keys in KEYS.items():
        op.drop_constraint(f'{table}_pkey', table, type_='primary')
        op.create_primary_key(f'{table}_pkey', table, ['run_id', *keys])
    op.drop_column('system_block', 'curtail_inr')
    op.drop_column('system_block', 'wear_inr')
    op.drop_column('system_block', 'dr_inr')
    op.drop_column('system_block', 'dsm_inr')
    op.drop_column('system_block', 'market_inr')
    op.drop_column('system_block', 'deviation_mw')
    op.drop_column('system_block', 'schedule_mw')
    op.drop_column('system_block', 'policy')
    op.drop_column('run', 'dam_schedule')
    op.drop_column('portfolio', 'market')
    op.drop_column('line_block', 'policy')
    op.drop_column('asset_block', 'policy')
    op.drop_index(op.f('ix_plan_cycle_id'), table_name='plan')
    op.drop_table('plan')
    op.drop_index('ix_action_run_block', table_name='action')
    op.drop_table('action')
    op.drop_table('cycle')
