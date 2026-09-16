"""add verified_by_admin_at to customers

Revision ID: b3c7e2f9a145
Revises: 385597b9ad06
Create Date: 2026-09-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c7e2f9a145'
down_revision: Union[str, None] = '385597b9ad06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customers", sa.Column("verified_by_admin_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("customers", "verified_by_admin_at")
