"""forecast and price feeds

Revision ID: 5b1e7c2d9a40
Revises: 2c8556b43383
Create Date: 2026-10-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5b1e7c2d9a40'
down_revision: Union[str, Sequence[str], None] = '2c8556b43383'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """A site can also keep the forecast and market price feeds it was connected to."""
    op.drop_constraint('data_source_kind', 'data_source', type_='check')
    op.create_check_constraint('data_source_kind', 'data_source', "kind IN ('csv', 'api', 'forecast', 'prices')")


def downgrade() -> None:
    op.execute("DELETE FROM data_source WHERE kind IN ('forecast', 'prices')")
    op.drop_constraint('data_source_kind', 'data_source', type_='check')
    op.create_check_constraint('data_source_kind', 'data_source', "kind IN ('csv', 'api')")
