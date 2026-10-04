"""data sources and config activation

Revision ID: 7cf8fed92eea
Revises: c757ce7d1ab2
Create Date: 2026-10-04 21:13:38.306105

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7cf8fed92eea'
down_revision: Union[str, Sequence[str], None] = 'c757ce7d1ab2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('data_source',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=8), nullable=False),
    sa.Column('name', sa.String(length=300), nullable=False),
    sa.Column('rows', sa.Integer(), nullable=True),
    sa.Column('columns', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('content', sa.LargeBinary(), nullable=True),
    sa.Column('refresh_min', sa.Integer(), nullable=True),
    sa.Column('created_by', sa.String(length=320), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind IN ('csv', 'api')", name='data_source_kind'),
    sa.ForeignKeyConstraint(['site_id'], ['site.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_data_source_site_id'), 'data_source', ['site_id'], unique=False)
    op.add_column('action_config', sa.Column('activated_by', sa.String(length=320), nullable=True))
    op.add_column('action_config', sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('action_config', 'activated_at')
    op.drop_column('action_config', 'activated_by')
    op.drop_index(op.f('ix_data_source_site_id'), table_name='data_source')
    op.drop_table('data_source')
