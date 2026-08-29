"""PUT/DELETE /api/v1/gifts/catalog/{id}/image — gift catalog item photos."""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.role import Role
from app.models.user import User

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c626001000000ffff03000006000557bfabd4"
    "0000000049454e44ae426082"
)


@pytest.fixture(autouse=True)
def _use_temp_gift_image_dir(tmp_path, monkeypatch) -> None:
    """Redirects uploads to a throwaway directory for the test, instead of
    the real `var/public/gift-images` a running dev server may also be
    using — without this, these tests could delete a real gift photo."""
    monkeypatch.setattr(settings, "GIFT_IMAGE_UPLOAD_DIR", str(tmp_path))


async def _add_catalog_item(
    db_session: AsyncSession, *, name: str = "Test Gift"
) -> GiftCatalogItem:
    category = GiftCategory(name=f"Category for {name}")
    db_session.add(category)
    await db_session.flush()

    item = GiftCatalogItem(
        name=name,
        category_id=category.id,
        description="A test gift",
        retail_value="500.00",
        stock_quantity=10,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def test_catalog_item_starts_with_no_image(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    item = await _add_catalog_item(db_session)

    response = await client.get("/api/v1/gifts/catalog")
    row = next(row for row in response.json()["data"] if row["name"] == item.name)
    assert row["image_url"] is None


async def test_uploading_an_image_returns_a_servable_url(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    item = await _add_catalog_item(db_session)

    response = await client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        files={"file": ("gift.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 200

    image_url = response.json()["data"]["image_url"]
    assert image_url is not None
    assert image_url.startswith("/gift-images/")

    follow_up = await client.get("/api/v1/gifts/catalog")
    row = next(row for row in follow_up.json()["data"] if row["name"] == item.name)
    assert row["image_url"] == image_url


async def test_rejects_non_image_content_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    item = await _add_catalog_item(db_session)

    response = await client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        files={"file": ("gift.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 422


async def test_rejects_oversized_file(client: AsyncClient, db_session: AsyncSession) -> None:
    item = await _add_catalog_item(db_session)
    oversized = b"\x00" * (2 * 1024 * 1024 + 1)

    response = await client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        files={"file": ("gift.png", oversized, "image/png")},
    )
    assert response.status_code == 422


async def test_uploading_a_new_image_removes_the_previous_file(
    client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    item = await _add_catalog_item(db_session)

    first = await client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        files={"file": ("gift.png", PNG_1X1, "image/png")},
    )
    first_url = first.json()["data"]["image_url"]
    first_path = tmp_path / Path(first_url).name
    assert first_path.exists()

    second = await client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        files={"file": ("gift2.png", PNG_1X1, "image/png")},
    )
    second_url = second.json()["data"]["image_url"]

    assert second_url != first_url
    assert not first_path.exists()


async def test_removing_the_image_clears_it(
    client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    item = await _add_catalog_item(db_session)

    uploaded = await client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        files={"file": ("gift.png", PNG_1X1, "image/png")},
    )
    image_path = tmp_path / Path(uploaded.json()["data"]["image_url"]).name
    assert image_path.exists()

    response = await client.delete(f"/api/v1/gifts/catalog/{item.public_id}/image")
    assert response.status_code == 200
    assert response.json()["data"]["image_url"] is None
    assert not image_path.exists()


async def test_deleting_the_catalog_item_removes_its_image_file(
    client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    item = await _add_catalog_item(db_session)

    uploaded = await client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        files={"file": ("gift.png", PNG_1X1, "image/png")},
    )
    image_path = tmp_path / Path(uploaded.json()["data"]["image_url"]).name
    assert image_path.exists()

    response = await client.delete(f"/api/v1/gifts/catalog/{item.public_id}")
    assert response.status_code == 204
    assert not image_path.exists()


async def test_staff_cannot_upload_image(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    role = (await db_session.execute(select(Role).where(Role.name == "Staff"))).scalar_one()
    staff = User(
        email="staff.gift-image@topten.com.bd",
        hashed_password=hash_password("some-password-123"),
        name="Staff User",
        role_id=role.id,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)

    item = await _add_catalog_item(db_session)
    token = create_access_token(user_public_id=str(staff.public_id))

    response = await unauthenticated_client.put(
        f"/api/v1/gifts/catalog/{item.public_id}/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("gift.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 403
