"""add favicon_path to site_settings

Revision ID: 5b719b849268
Revises: 24e678beac18
Create Date: 2026-09-09 14:21:18.092518

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b719b849268'
down_revision: Union[str, None] = '24e678beac18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "site_settings",
        sa.Column("favicon_path", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("site_settings", "favicon_path")
