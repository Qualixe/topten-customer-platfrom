"""add email channel to birthday wishes

Revision ID: 056e35d09c4c
Revises: e23bef7ae009
Create Date: 2026-09-07 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '056e35d09c4c'
down_revision: Union[str, None] = 'e23bef7ae009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'birthday_settings',
        sa.Column('auto_send_email', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'birthday_settings',
        sa.Column(
            'email_subject',
            sa.String(length=255),
            nullable=False,
            server_default='Happy Birthday, {{customer_name}}! 🎉',
        ),
    )
    op.add_column(
        'birthday_settings',
        sa.Column(
            'email_message_template',
            sa.String(length=2000),
            nullable=False,
            server_default='<p>Happy Birthday, {{customer_name}}!</p><p>Wishing you a wonderful year ahead. 🎉</p>',
        ),
    )
    op.add_column(
        'customers',
        sa.Column('last_birthday_email_year', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('customers', 'last_birthday_email_year')
    op.drop_column('birthday_settings', 'email_message_template')
    op.drop_column('birthday_settings', 'email_subject')
    op.drop_column('birthday_settings', 'auto_send_email')
