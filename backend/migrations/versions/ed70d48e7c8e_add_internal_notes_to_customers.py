"""add internal_notes to customers

Revision ID: ed70d48e7c8e
Revises: 5b719b849268
Create Date: 2026-09-10 11:04:10.784704

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed70d48e7c8e'
down_revision: Union[str, None] = '5b719b849268'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("internal_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "internal_notes")
