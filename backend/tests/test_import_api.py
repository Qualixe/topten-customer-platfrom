"""API contract tests for the 3 import endpoints.

`process_import_batch.delay` is patched out here — these tests check the
HTTP contract (status codes, response shape, persistence of the ImportBatch
row) rather than re-running the processing pipeline, which is already
covered directly in test_import_idempotency_retry.py /
test_large_batch_processing.py against the test database.
"""

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.import_batch import ImportBatch, ImportBatchStatus


@pytest.fixture(autouse=True)
def _patch_celery_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.api.v1.endpoints.imports.process_import_batch.delay",
        lambda import_batch_id: None,
    )


def _csv_file(content: str = "name,phone,amount\nRahim Uddin,01711000101,10000\n"):
    return {"file": ("import.csv", io.BytesIO(content.encode()), "text/csv")}


def _upload_data(period_year: int = 2026, period_month: int = 1, customer_type: str = "GENERAL"):
    return {
        "period_year": period_year,
        "period_month": period_month,
        "customer_type": customer_type,
    }


async def test_upload_returns_the_documented_response_shape(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/imports/customers",
        data=_upload_data(customer_type="VIP"),
        files=_csv_file(),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "UPLOADED"
    assert body["data"]["customer_type"] == "VIP"
    uuid.UUID(body["data"]["import_id"])  # must be a valid UUID


async def test_upload_persists_an_import_batch_row(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    response = await client.post(
        "/api/v1/imports/customers",
        data=_upload_data(period_month=3, customer_type="VVIP"),
        files=_csv_file(),
    )
    import_id = response.json()["data"]["import_id"]

    batch = (
        await db_session.execute(
            select(ImportBatch).where(ImportBatch.public_id == uuid.UUID(import_id))
        )
    ).scalar_one()
    assert batch.period_year == 2026
    assert batch.period_month == 3
    assert batch.customer_type == "VVIP"
    assert batch.status == ImportBatchStatus.UPLOADED.value
    assert batch.file_name == "import.csv"


async def test_non_csv_file_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/imports/customers",
        data=_upload_data(),
        files={"file": ("import.txt", io.BytesIO(b"not a csv"), "text/plain")},
    )
    assert response.status_code == 422


async def test_invalid_period_month_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/imports/customers",
        data=_upload_data(period_month=13),
        files=_csv_file(),
    )
    assert response.status_code == 422


async def test_missing_customer_type_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/imports/customers",
        data={"period_year": 2026, "period_month": 1},
        files=_csv_file(),
    )
    assert response.status_code == 422


async def test_invalid_customer_type_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/imports/customers",
        data=_upload_data(customer_type="PLATINUM"),
        files=_csv_file(),
    )
    assert response.status_code == 422


async def test_get_import_batch_by_id(client: AsyncClient) -> None:
    upload = await client.post(
        "/api/v1/imports/customers",
        data=_upload_data(),
        files=_csv_file(),
    )
    import_id = upload.json()["data"]["import_id"]

    response = await client.get(f"/api/v1/imports/{import_id}")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["import_id"] == import_id
    assert data["customer_type"] == "GENERAL"
    assert "progress_percentage" in data
    assert "processed_rows" in data
    assert "new_customers" in data


async def test_get_unknown_import_batch_returns_404(client: AsyncClient) -> None:
    response = await client.get(f"/api/v1/imports/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_list_import_batches(client: AsyncClient) -> None:
    for month in (1, 2):
        await client.post(
            "/api/v1/imports/customers",
            data=_upload_data(period_month=month),
            files=_csv_file(),
        )

    response = await client.get("/api/v1/imports")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["total"] >= 2
    assert len(body["data"]) >= 2
