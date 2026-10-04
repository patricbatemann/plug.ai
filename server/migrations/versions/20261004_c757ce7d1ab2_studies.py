"""studies

Revision ID: c757ce7d1ab2
Revises: cc91b17e2d25
Create Date: 2026-10-04 20:50:37.843140

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c757ce7d1ab2'
down_revision: Union[str, Sequence[str], None] = 'cc91b17e2d25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('study',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('portfolio_id', sa.Integer(), nullable=False),
    sa.Column('preset', sa.String(length=32), nullable=False),
    sa.Column('seeds', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.String(length=320), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.add_column('run', sa.Column('study_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_run_study_id'), 'run', ['study_id'], unique=False)
    op.create_foreign_key('run_study_id_fkey', 'run', 'study', ['study_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('run_study_id_fkey', 'run', type_='foreignkey')
    op.drop_index(op.f('ix_run_study_id'), table_name='run')
    op.drop_column('run', 'study_id')
    op.drop_table('study')
