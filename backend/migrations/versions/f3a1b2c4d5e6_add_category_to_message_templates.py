"""add category to message_templates

Revision ID: f3a1b2c4d5e6
Revises: 9d5ef0f108f4
Create Date: 2026-08-31 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a1b2c4d5e6"
down_revision: Union[str, None] = "9d5ef0f108f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "message_templates",
        sa.Column(
            "category",
            sa.String(length=30),
            nullable=False,
            server_default="GENERAL",
        ),
    )
    op.create_index(
        op.f("ix_message_templates_category"),
        "message_templates",
        ["category"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_message_templates_category"), table_name="message_templates"
    )
    op.drop_column("message_templates", "category")
