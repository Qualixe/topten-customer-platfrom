"""add customer_note to customers

Revision ID: 385597b9ad06
Revises: ed70d48e7c8e
Create Date: 2026-09-10 13:37:38.321435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '385597b9ad06'
down_revision: Union[str, None] = 'ed70d48e7c8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("customer_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "customer_note")
