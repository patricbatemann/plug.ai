"""initial schema

Revision ID: d26aac124216
Revises: 
Create Date: 2026-10-04 14:27:59.848155

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd26aac124216'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('portfolio',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('tz', sa.String(length=40), nullable=False),
    sa.Column('mode_code', sa.String(length=32), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_table('node',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('portfolio_id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('portfolio_id', 'code')
    )
    op.create_table('site',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('portfolio_id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('location', sa.String(length=120), nullable=False),
    sa.Column('commissioned_on', sa.Date(), nullable=False),
    sa.CheckConstraint("kind IN ('solar', 'wind', 'hybrid', 'industrial')", name='site_kind'),
    sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('portfolio_id', 'code')
    )
    op.create_table('asset',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('portfolio_id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('node_id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('capacity_mw', sa.Float(), nullable=False),
    sa.Column('params', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.CheckConstraint("kind IN ('solar', 'wind', 'bess', 'consumer', 'interconnection')", name='asset_kind'),
    sa.ForeignKeyConstraint(['node_id'], ['node.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['site_id'], ['site.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('portfolio_id', 'code')
    )
    op.create_index(op.f('ix_asset_site_id'), 'asset', ['site_id'], unique=False)
    op.create_table('line',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('portfolio_id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('from_node_id', sa.Integer(), nullable=False),
    sa.Column('to_node_id', sa.Integer(), nullable=False),
    sa.Column('limit_mw', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['from_node_id'], ['node.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['to_node_id'], ['node.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('portfolio_id', 'code')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('line')
    op.drop_index(op.f('ix_asset_site_id'), table_name='asset')
    op.drop_table('asset')
    op.drop_table('site')
    op.drop_table('node')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('portfolio')
