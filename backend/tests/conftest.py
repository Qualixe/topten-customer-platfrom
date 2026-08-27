"""
Shared pytest fixtures for the POS import test suite.

Tests run against a real Postgres database (`topten_test`, migrated the same
way as the dev database — see the "Verification" section of the import
implementation) rather than mocks: the whole point of this suite is
verifying real constraint/upsert/transaction behavior, which an in-memory
substitute wouldn't exercise faithfully.
"""

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.common.dependencies import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from app.models.campaign import Campaign
from app.models.campaign_landing_page import CampaignLandingPage
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer
from app.models.customer_monthly_spending import CustomerMonthlySpending
from app.models.customer_profile_token import CustomerProfileToken
from app.models.form import Form
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.gift_order import GiftOrder
from app.models.import_batch import ImportBatch
from app.models.import_row_error import ImportRowError
from app.models.integration_credential import IntegrationCredential
from app.models.permission import Permission
from app.models.role import Role, role_permissions
from app.models.site_settings import SiteSettings
from app.models.user import User
from app.models.user_permission_override import UserPermissionOverride
from scripts.seed_auth import seed_auth

TEST_DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/topten_test"

test_engine = create_async_engine(TEST_DATABASE_URL, future=True, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(bind=test_engine, expire_on_commit=False, future=True)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables() -> AsyncGenerator[None, None]:
    """Truncates every import-related table before each test for isolation."""
    async with test_engine.begin() as conn:
        await conn.execute(role_permissions.delete())
        for table in (
            ImportRowError,
            CustomerMonthlySpending,
            CustomerProfileToken,
            ImportBatch,
            CampaignRecipient,
            CampaignLandingPage,
            Campaign,
            Form,
            GiftOrder,
            GiftCatalogItem,
            GiftCategory,
            Customer,
            IntegrationCredential,
            SiteSettings,
            UserPermissionOverride,
            User,
            Role,
            Permission,
        ):
            await conn.execute(table.__table__.delete())
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """The bootstrap Admin user, seeded fresh (same seed data the real
    `scripts.seed_auth` script produces) since `_clean_tables` truncates
    `users`/`roles`/`permissions` before every test."""
    await seed_auth(session_factory=TestSessionLocal)
    user = (
        await db_session.execute(select(User).where(User.email == "admin@topten.com.bd"))
    ).scalar_one()
    return user


@pytest_asyncio.fixture
async def unauthenticated_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """A client with no Authorization header — for testing the auth
    boundary itself (login, missing/invalid tokens, permission denial)."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(
    db_session: AsyncSession, admin_user: User
) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated as the seeded Admin by default, so every pre-existing
    test (written before auth existed) keeps working unmodified. Tests that
    care about auth itself use `unauthenticated_client` instead."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    token = create_access_token(user_public_id=str(admin_user.public_id))
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def _dispose_engine_at_end():
    yield
    asyncio.run(test_engine.dispose())
