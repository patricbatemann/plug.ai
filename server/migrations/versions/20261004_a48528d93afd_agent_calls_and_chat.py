"""agent calls and chat

Revision ID: a48528d93afd
Revises: e0510054c8fe
Create Date: 2026-10-04 19:14:00.968878

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a48528d93afd'
down_revision: Union[str, Sequence[str], None] = 'e0510054c8fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('chat_message',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(length=16), nullable=False),
    sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_message_run_user', 'chat_message', ['run_id', 'user_id', 'id'], unique=False)
    op.create_table('agent_call',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('run_id', sa.Integer(), nullable=True),
    sa.Column('cycle_id', sa.Integer(), nullable=True),
    sa.Column('purpose', sa.String(length=16), nullable=False),
    sa.Column('deployment', sa.String(length=64), nullable=False),
    sa.Column('input_tokens', sa.Integer(), nullable=False),
    sa.Column('output_tokens', sa.Integer(), nullable=False),
    sa.Column('cached_tokens', sa.Integer(), nullable=False),
    sa.Column('latency_ms', sa.Integer(), nullable=False),
    sa.Column('tool_calls', sa.Integer(), nullable=False),
    sa.Column('outcome', sa.String(length=16), nullable=False),
    sa.Column('error', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['cycle_id'], ['cycle.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['run_id'], ['run.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_agent_call_run_id'), 'agent_call', ['run_id'], unique=False)
    op.add_column('cycle', sa.Column('selected_by', sa.String(length=16), server_default='rule', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cycle', 'selected_by')
    op.drop_index(op.f('ix_agent_call_run_id'), table_name='agent_call')
    op.drop_table('agent_call')
    op.drop_index('ix_chat_message_run_user', table_name='chat_message')
    op.drop_table('chat_message')
