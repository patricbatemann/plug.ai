"""keep action config preferences

Revision ID: c8972c0158b7
Revises: 1a645f915bc5
Create Date: 2026-10-10 20:45:42.163086

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c8972c0158b7'
down_revision: Union[str, Sequence[str], None] = '1a645f915bc5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('action_config', sa.Column('preferences', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False))


def downgrade() -> None:
    op.drop_column('action_config', 'preferences')
