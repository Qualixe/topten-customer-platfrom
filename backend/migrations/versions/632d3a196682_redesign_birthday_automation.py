"""redesign birthday automation

Revision ID: 632d3a196682
Revises: 056e35d09c4c
Create Date: 2026-09-07 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '632d3a196682'
down_revision: Union[str, None] = '056e35d09c4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'birthday_settings',
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'birthday_settings',
        sa.Column('channel', sa.String(length=10), nullable=False, server_default='SMS'),
    )
    op.add_column(
        'birthday_settings',
        sa.Column('send_hour', sa.Integer(), nullable=False, server_default='9'),
    )
    op.add_column(
        'birthday_settings',
        sa.Column('company_name', sa.String(length=120), nullable=False, server_default=''),
    )
    op.add_column(
        'birthday_settings',
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Data-migrate the old independent SMS/email booleans into the new
    # single enabled + channel selector before dropping them.
    op.execute(
        """
        UPDATE birthday_settings
        SET enabled = (auto_send_message OR auto_send_email),
            channel = CASE
                WHEN auto_send_message AND auto_send_email THEN 'BOTH'
                WHEN auto_send_email THEN 'EMAIL'
                ELSE 'SMS'
            END
        """
    )

    op.drop_column('birthday_settings', 'auto_send_message')
    op.drop_column('birthday_settings', 'auto_send_email')


def downgrade() -> None:
    op.add_column(
        'birthday_settings',
        sa.Column('auto_send_message', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'birthday_settings',
        sa.Column('auto_send_email', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.execute(
        """
        UPDATE birthday_settings
        SET auto_send_message = (channel IN ('SMS', 'BOTH')) AND enabled,
            auto_send_email = (channel IN ('EMAIL', 'BOTH')) AND enabled
        """
    )

    op.drop_column('birthday_settings', 'last_run_at')
    op.drop_column('birthday_settings', 'company_name')
    op.drop_column('birthday_settings', 'send_hour')
    op.drop_column('birthday_settings', 'channel')
    op.drop_column('birthday_settings', 'enabled')
