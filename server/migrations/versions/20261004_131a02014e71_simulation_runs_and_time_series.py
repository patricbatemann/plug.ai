"""simulation runs and time series

Revision ID: 131a02014e71
Revises: d26aac124216
Create Date: 2026-10-04 14:46:09.075415

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '131a02014e71'
down_revision: Union[str, Sequence[str], None] = 'd26aac124216'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('run',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('portfolio_id', sa.Integer(), nullable=False),
    sa.Column('preset', sa.String(length=32), nullable=False),
    sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('speed', sa.Float(), nullable=False),
    sa.Column('sim_start_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('total_blocks', sa.Integer(), nullable=False),
    sa.Column('live_from_block', sa.Integer(), nullable=False),
    sa.Column('current_block', sa.Integer(), nullable=False),
    sa.Column('block_started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('next_due_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('running', 'paused', 'done')", name='run_status'),
    sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_run_clock', 'run', ['status', 'next_due_at'], unique=False)
    op.create_table('system_block',
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('block', sa.Integer(), nullable=False),
    sa.Column('frequency_hz', sa.Float(), nullable=False),
    sa.Column('dam_price', sa.Float(), nullable=False),
    sa.Column('rtm_price', sa.Float(), nullable=False),
    sa.Column('emission_factor', sa.Float(), nullable=False),
    sa.Column('net_exchange_mw', sa.Float(), nullable=False),
    sa.Column('cost_inr', sa.Float(), nullable=False),
    sa.Column('carbon_t', sa.Float(), nullable=False),
    sa.Column('curtailed_mwh', sa.Float(), nullable=False),
    sa.Column('unserved_mwh', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('run_id', 'block')
    )
    op.create_table('world_event',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('sim_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('source', sa.String(length=16), nullable=False),
    sa.Column('fired_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revealed', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_world_event_run', 'world_event', ['run_id', 'sim_at'], unique=False)
    op.create_table('asset_block',
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('block', sa.Integer(), nullable=False),
    sa.Column('asset_id', sa.Integer(), nullable=False),
    sa.Column('available_mw', sa.Float(), nullable=False),
    sa.Column('actual_mw', sa.Float(), nullable=False),
    sa.Column('soc_mwh', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['asset_id'], ['asset.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('run_id', 'block', 'asset_id')
    )
    op.create_table('forecast',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('issued_block', sa.Integer(), nullable=False),
    sa.Column('series', sa.String(length=16), nullable=False),
    sa.Column('asset_id', sa.Integer(), nullable=True),
    sa.Column('p10', sa.ARRAY(sa.Float()), nullable=False),
    sa.Column('p50', sa.ARRAY(sa.Float()), nullable=False),
    sa.Column('p90', sa.ARRAY(sa.Float()), nullable=False),
    sa.ForeignKeyConstraint(['asset_id'], ['asset.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_forecast_lookup', 'forecast', ['run_id', 'series', 'asset_id', 'issued_block'], unique=False)
    op.create_table('line_block',
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('block', sa.Integer(), nullable=False),
    sa.Column('line_id', sa.Integer(), nullable=False),
    sa.Column('limit_mw', sa.Float(), nullable=False),
    sa.Column('flow_mw', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['line_id'], ['line.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('run_id', 'block', 'line_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('line_block')
    op.drop_index('ix_forecast_lookup', table_name='forecast')
    op.drop_table('forecast')
    op.drop_table('asset_block')
    op.drop_index('ix_world_event_run', table_name='world_event')
    op.drop_table('world_event')
    op.drop_table('system_block')
    op.drop_index('ix_run_clock', table_name='run')
    op.drop_table('run')
