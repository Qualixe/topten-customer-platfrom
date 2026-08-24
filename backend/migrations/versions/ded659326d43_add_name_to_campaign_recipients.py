"""add name to campaign recipients

Revision ID: ded659326d43
Revises: e013863e9e3f
Create Date: 2026-08-24 15:30:35.740606

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ded659326d43'
down_revision: Union[str, None] = 'e013863e9e3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable first so this doesn't fail against any existing recipient
    # rows, backfilled from customers (name is NOT NULL there), then
    # tightened to NOT NULL to match every row resolved from here on —
    # `resolve_campaign_audience` always populates it going forward.
    op.add_column('campaign_recipients', sa.Column('name', sa.String(length=255), nullable=True))
    op.execute(
        """
        UPDATE campaign_recipients
        SET name = customers.name
        FROM customers
        WHERE campaign_recipients.customer_id = customers.id
        """
    )
    op.alter_column('campaign_recipients', 'name', nullable=False)


def downgrade() -> None:
    op.drop_column('campaign_recipients', 'name')
