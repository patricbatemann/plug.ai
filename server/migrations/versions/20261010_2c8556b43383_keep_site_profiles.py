"""keep site profiles

Revision ID: 2c8556b43383
Revises: c8972c0158b7
Create Date: 2026-10-10 21:25:16.130962

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2c8556b43383'
down_revision: Union[str, Sequence[str], None] = 'c8972c0158b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Sites keep a profile for people; existing sites get the one the seed gives them."""
    op.add_column('site', sa.Column('profile', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False))
    op.execute("""
        UPDATE site SET profile = jsonb_build_object('address', location, 'grid_region', 'Andhra Pradesh DISCOM')
        WHERE code <> 'KUP-SOLAR-001'
    """)
    op.execute("""
        UPDATE site SET profile = '{"owner": "Kuppam Solar Site Operations", "operator": "Kuppam Operations Team",
          "description": "Utility-scale solar photovoltaic installation with battery storage support.",
          "contact": {"name": "Bharath Kumar", "role": "Site Manager", "email": "bharath.kumar@example.com",
                      "phone": "+91 98765 43210"},
          "address": "Kuppam, Chittoor District, Andhra Pradesh, India", "latitude": 12.748, "longitude": 78.341,
          "elevation_m": 680, "grid_region": "Andhra Pradesh DISCOM"}'::jsonb
        WHERE code = 'KUP-SOLAR-001'
    """)


def downgrade() -> None:
    op.drop_column('site', 'profile')
