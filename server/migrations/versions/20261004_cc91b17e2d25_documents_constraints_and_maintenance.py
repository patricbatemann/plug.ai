"""documents constraints and maintenance

Revision ID: cc91b17e2d25
Revises: a48528d93afd
Create Date: 2026-10-04 20:22:46.086803

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'cc91b17e2d25'
down_revision: Union[str, Sequence[str], None] = 'a48528d93afd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('document',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=200), nullable=False),
    sa.Column('mime', sa.String(length=64), nullable=False),
    sa.Column('content', sa.LargeBinary(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('text', sa.Text(), nullable=True),
    sa.Column('extraction', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('uploaded_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_document_run_id'), 'document', ['run_id'], unique=False)
    op.create_table('maintenance_task',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('asset_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('duration_blocks', sa.Integer(), nullable=False),
    sa.Column('earliest_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deadline_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('calendar_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('safety_critical', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['asset_id'], ['asset.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maintenance_task_run_id'), 'maintenance_task', ['run_id'], unique=False)
    op.create_table('run_constraint',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('document_id', sa.Integer(), nullable=True),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('targets', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('value', sa.Float(), nullable=True),
    sa.Column('quote', sa.String(length=600), nullable=False),
    sa.Column('confidence', sa.Float(), nullable=False),
    sa.Column('verified', sa.Boolean(), nullable=False),
    sa.Column('tightens', sa.Boolean(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('note', sa.String(length=300), server_default='', nullable=False),
    sa.Column('decided_by', sa.String(length=320), nullable=True),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['document_id'], ['document.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_run_constraint_run_id'), 'run_constraint', ['run_id'], unique=False)
    op.add_column('action', sa.Column('params', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('action', 'params')
    op.drop_index(op.f('ix_run_constraint_run_id'), table_name='run_constraint')
    op.drop_table('run_constraint')
    op.drop_index(op.f('ix_maintenance_task_run_id'), table_name='maintenance_task')
    op.drop_table('maintenance_task')
    op.drop_index(op.f('ix_document_run_id'), table_name='document')
    op.drop_table('document')
