"""PUT/DELETE /api/v1/settings/logo (protected) and GET
/api/v1/public/site-logo (unauthenticated — the logo is shown on /login and
public customer-facing pages too, which have no session)."""

from pathlib import Path

import pytest
from httpx import AsyncClient

from app.core.config import settings

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c626001000000ffff03000006000557bfabd4"
    "0000000049454e44ae426082"
)


@pytest.fixture(autouse=True)
def _use_temp_branding_dir(tmp_path, monkeypatch) -> None:
    """Redirects uploads to a throwaway directory for the test, instead of
    the real `var/public/branding` a running dev server may also be using —
    without this, these tests could delete a logo you'd actually uploaded."""
    monkeypatch.setattr(settings, "BRANDING_UPLOAD_DIR", str(tmp_path))


async def test_logo_starts_unset(client: AsyncClient) -> None:
    response = await client.get("/api/v1/public/site-logo")
    assert response.status_code == 200
    assert response.json()["data"] == {"logo_url": None}


async def test_public_site_logo_requires_no_auth(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/public/site-logo")
    assert response.status_code == 200
    assert response.json()["data"] == {"logo_url": None}


async def test_uploading_a_logo_returns_a_servable_url(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/logo",
        files={"file": ("logo.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 200

    logo_url = response.json()["data"]["logo_url"]
    assert logo_url is not None
    assert logo_url.startswith("/branding/")

    follow_up = await client.get("/api/v1/public/site-logo")
    assert follow_up.json()["data"]["logo_url"] == logo_url


async def test_rejects_non_image_content_type(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/logo",
        files={"file": ("logo.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 422


async def test_rejects_oversized_file(client: AsyncClient) -> None:
    oversized = b"\x00" * (2 * 1024 * 1024 + 1)
    response = await client.put(
        "/api/v1/settings/logo",
        files={"file": ("logo.png", oversized, "image/png")},
    )
    assert response.status_code == 422


async def test_uploading_a_new_logo_removes_the_previous_file(
    client: AsyncClient, tmp_path: Path
) -> None:
    first = await client.put(
        "/api/v1/settings/logo", files={"file": ("logo.png", PNG_1X1, "image/png")}
    )
    first_url = first.json()["data"]["logo_url"]
    first_path = tmp_path / Path(first_url).name
    assert first_path.exists()

    second = await client.put(
        "/api/v1/settings/logo", files={"file": ("logo2.png", PNG_1X1, "image/png")}
    )
    second_url = second.json()["data"]["logo_url"]

    assert second_url != first_url
    assert not first_path.exists()


async def test_removing_the_logo_clears_it(client: AsyncClient, tmp_path: Path) -> None:
    uploaded = await client.put(
        "/api/v1/settings/logo", files={"file": ("logo.png", PNG_1X1, "image/png")}
    )
    logo_path = tmp_path / Path(uploaded.json()["data"]["logo_url"]).name
    assert logo_path.exists()

    response = await client.delete("/api/v1/settings/logo")
    assert response.status_code == 200
    assert response.json()["data"] == {"logo_url": None}
    assert not logo_path.exists()

    follow_up = await client.get("/api/v1/public/site-logo")
    assert follow_up.json()["data"]["logo_url"] is None
