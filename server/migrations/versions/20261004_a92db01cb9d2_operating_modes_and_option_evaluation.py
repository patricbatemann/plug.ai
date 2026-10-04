"""operating modes and option evaluation

Revision ID: a92db01cb9d2
Revises: 0e947c328ea8
Create Date: 2026-10-04 15:32:31.686593

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a92db01cb9d2'
down_revision: Union[str, Sequence[str], None] = '0e947c328ea8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cycle', sa.Column('situation', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('cycle', sa.Column('mode', sa.String(length=32), server_default='balanced', nullable=False))
    op.add_column('cycle', sa.Column('mode_by', sa.String(length=16), server_default='rule', nullable=False))
    op.add_column('cycle', sa.Column('mode_reason', sa.String(length=300), server_default='', nullable=False))
    op.add_column('cycle', sa.Column('floors', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('cycle', sa.Column('scenarios', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('cycle', sa.Column('rationale', sa.String(length=600), server_default='', nullable=False))
    op.add_column('plan', sa.Column('robust', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('run', sa.Column('mode_code', sa.String(length=32), server_default='balanced', nullable=False))
    op.add_column('run', sa.Column('mode_by', sa.String(length=16), server_default='operator', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('run', 'mode_by')
    op.drop_column('run', 'mode_code')
    op.drop_column('plan', 'robust')
    op.drop_column('cycle', 'rationale')
    op.drop_column('cycle', 'scenarios')
    op.drop_column('cycle', 'floors')
    op.drop_column('cycle', 'mode_reason')
    op.drop_column('cycle', 'mode_by')
    op.drop_column('cycle', 'mode')
    op.drop_column('cycle', 'situation')
