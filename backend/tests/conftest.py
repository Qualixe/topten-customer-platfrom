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
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.common.dependencies import get_db
from app.core.config import settings
from app.main import app
from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer
from app.models.customer_monthly_spending import CustomerMonthlySpending
from app.models.customer_profile_token import CustomerProfileToken
from app.models.import_batch import ImportBatch
from app.models.import_row_error import ImportRowError
from app.models.integration_credential import IntegrationCredential
from app.models.site_settings import SiteSettings

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
        for table in (
            ImportRowError,
            CustomerMonthlySpending,
            CustomerProfileToken,
            ImportBatch,
            CampaignRecipient,
            Campaign,
            Customer,
            IntegrationCredential,
            SiteSettings,
        ):
            await conn.execute(table.__table__.delete())
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def _dispose_engine_at_end():
    yield
    asyncio.run(test_engine.dispose())
