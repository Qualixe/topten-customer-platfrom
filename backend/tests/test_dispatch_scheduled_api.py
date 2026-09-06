"""POST /api/v1/sms/campaigns/dispatch-scheduled — the on-demand version of
the periodic Celery-beat catch-up tasks (see
tests/test_dispatch_due_scheduled_campaigns.py and
tests/test_retry_stuck_unresolved_campaigns.py for the underlying logic)."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


async def test_dispatch_scheduled_with_nothing_to_do(client: AsyncClient) -> None:
    with patch(
        "app.controllers.sms_campaigns.dispatch_due_scheduled_campaigns_async",
        new=AsyncMock(return_value=0),
    ), patch(
        "app.controllers.sms_campaigns.retry_stuck_unresolved_campaigns_async",
        new=AsyncMock(return_value=0),
    ):
        response = await client.post("/api/v1/sms/campaigns/dispatch-scheduled")

    assert response.status_code == 200
    assert response.json()["data"] == {"dispatched_due": 0, "retried_unresolved": 0}


async def test_dispatch_scheduled_reports_counts(client: AsyncClient) -> None:
    with patch(
        "app.controllers.sms_campaigns.dispatch_due_scheduled_campaigns_async",
        new=AsyncMock(return_value=2),
    ), patch(
        "app.controllers.sms_campaigns.retry_stuck_unresolved_campaigns_async",
        new=AsyncMock(return_value=1),
    ):
        response = await client.post("/api/v1/sms/campaigns/dispatch-scheduled")

    assert response.status_code == 200
    assert response.json()["data"] == {"dispatched_due": 2, "retried_unresolved": 1}


async def test_requires_auth(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.post("/api/v1/sms/campaigns/dispatch-scheduled")
    assert response.status_code == 401
