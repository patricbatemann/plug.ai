"""connect site telemetry apis

Revision ID: 1a645f915bc5
Revises: 7cf8fed92eea
Create Date: 2026-10-10 19:19:54.617189

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '1a645f915bc5'
down_revision: Union[str, Sequence[str], None] = '7cf8fed92eea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """BOB now commands only sites with a connected telemetry API: connect every existing site but
    Kuppam, as the seed does, so a seeded database keeps BOB acting where it did."""
    op.execute("""
        INSERT INTO data_source (site_id, kind, name, columns, created_by)
        SELECT id, 'api', '/api/mock/sites/' || code || '/telemetry', '[]', 'seed' FROM site
        WHERE code <> 'KUP-SOLAR-001'
          AND NOT EXISTS (SELECT 1 FROM data_source d WHERE d.site_id = site.id AND d.kind = 'api')
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM data_source WHERE kind = 'api' AND created_by = 'seed'")
