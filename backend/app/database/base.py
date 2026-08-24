from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""


# Import model modules so Alembic autogenerate can discover them.
from app.database import models  # noqa: E402, F401
