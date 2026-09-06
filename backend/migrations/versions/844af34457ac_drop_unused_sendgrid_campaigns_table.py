"""drop unused sendgrid_campaigns table

Revision ID: 844af34457ac
Revises: 1122e9e12117
Create Date: 2026-09-06 16:40:22.619041

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '844af34457ac'
down_revision: Union[str, None] = '1122e9e12117'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Never reached from any UI (see app.services.sendgrid_sync's module
    # docstring) — email now sends through Mailchimp only. The table is
    # empty in every real environment, so this is safe to drop outright.
    op.drop_index('ix_sendgrid_campaigns_status', table_name='sendgrid_campaigns')
    op.drop_index('ix_sendgrid_campaigns_public_id', table_name='sendgrid_campaigns')
    op.drop_table('sendgrid_campaigns')


def downgrade() -> None:
    op.create_table(
        'sendgrid_campaigns',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('public_id', sa.UUID(), nullable=False),
        sa.Column('sendgrid_campaign_id', sa.String(length=50), nullable=False),
        sa.Column('sendgrid_list_id', sa.String(length=50), nullable=True),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('from_name', sa.String(length=255), nullable=True),
        sa.Column('from_email', sa.String(length=255), nullable=True),
        sa.Column('html_body', sa.Text(), nullable=False),
        sa.Column('recipient_count', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='DRAFT', nullable=False),
        sa.Column('error_message', sa.String(length=500), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False
        ),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_sendgrid_campaigns_public_id', 'sendgrid_campaigns', ['public_id'], unique=True
    )
    op.create_index(
        'ix_sendgrid_campaigns_status', 'sendgrid_campaigns', ['status'], unique=False
    )
