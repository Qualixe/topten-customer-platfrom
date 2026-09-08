"""add send_minute to birthday_settings

Revision ID: 24e678beac18
Revises: 95edd2740242
Create Date: 2026-09-08 10:33:42.779227

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '24e678beac18'
down_revision: Union[str, None] = '95edd2740242'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "birthday_settings",
        sa.Column("send_minute", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("birthday_settings", "send_minute")
