"""watch conditions and config tests

Revision ID: e0510054c8fe
Revises: 820b689fdf9b
Create Date: 2026-10-04 16:10:37.320778

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e0510054c8fe'
down_revision: Union[str, Sequence[str], None] = '820b689fdf9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('action_config', sa.Column('watch', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('action_config', sa.Column('tests', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('action_config', 'tests')
    op.drop_column('action_config', 'watch')
