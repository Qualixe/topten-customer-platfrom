"""GET /api/v1/imports/{id}/errors — lets an admin see exactly which rows
failed and why, instead of only an aggregate invalid_rows count."""

from pathlib import Path

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.import_batch import ImportBatch, ImportBatchStatus
from app.modules.imports.tasks import _process_import_batch_async
from tests.conftest import TestSessionLocal


def _write_csv(tmp_path: Path, content: str) -> str:
    csv_path = tmp_path / "import.csv"
    csv_path.write_text(content, encoding="utf-8")
    return str(csv_path)


async def _create_and_process_batch(db_session: AsyncSession, tmp_path: Path, csv: str) -> str:
    file_path = _write_csv(tmp_path, csv)
    batch = ImportBatch(
        file_name="import.csv",
        file_path=file_path,
        period_year=2026,
        period_month=1,
        status=ImportBatchStatus.UPLOADED.value,
    )
    db_session.add(batch)
    await db_session.commit()
    await db_session.refresh(batch)

    await _process_import_batch_async(batch.id, session_factory=TestSessionLocal)
    return str(batch.public_id)


async def test_lists_row_errors_with_reason_and_raw_data(
    client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    csv = (
        "name,phone,amount\n"
        "Rahim Uddin,01711000101,1000\n"
        ",01711000102,500\n"  # missing name -> now falls back to phone, so this succeeds
        "Karim Ahmed,not-a-phone,1000\n"  # invalid phone -> real error
    )
    import_id = await _create_and_process_batch(db_session, tmp_path, csv)

    response = await client.get(f"/api/v1/imports/{import_id}/errors")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert body["total"] == 1
    assert len(body["data"]) == 1
    assert body["data"][0]["row_number"] == 3
    assert "phone" in body["data"][0]["error_message"].lower()
    assert body["data"][0]["raw_row"]["name"] == "Karim Ahmed"
    assert body["data"][0]["raw_row"]["phone"] == "not-a-phone"


async def test_no_errors_for_a_fully_valid_import(
    client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    csv = "name,phone,amount\nRahim Uddin,01711000101,1000\n"
    import_id = await _create_and_process_batch(db_session, tmp_path, csv)

    response = await client.get(f"/api/v1/imports/{import_id}/errors")
    assert response.json() == {"success": True, "data": [], "total": 0}


async def test_pagination(client: AsyncClient, db_session: AsyncSession, tmp_path: Path) -> None:
    rows = "\n".join(f"Bad Row {i},not-a-phone-{i},1000" for i in range(5))
    csv = f"name,phone,amount\n{rows}\n"
    import_id = await _create_and_process_batch(db_session, tmp_path, csv)

    response = await client.get(f"/api/v1/imports/{import_id}/errors", params={"limit": 2})
    body = response.json()
    assert body["total"] == 5
    assert len(body["data"]) == 2
    assert [row["row_number"] for row in body["data"]] == [1, 2]

    response2 = await client.get(
        f"/api/v1/imports/{import_id}/errors", params={"limit": 2, "offset": 2}
    )
    assert [row["row_number"] for row in response2.json()["data"]] == [3, 4]


async def test_unknown_import_batch_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/imports/00000000-0000-0000-0000-000000000000/errors"
    )
    assert response.status_code == 404
