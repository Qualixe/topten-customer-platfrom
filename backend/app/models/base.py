from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models. Every model module
    lives alongside this one in `app.models` and is imported by
    `app/models/__init__.py` — importing any name from this package (e.g.
    `Base` itself) runs that `__init__.py` first, per normal Python package
    semantics, so Alembic autogenerate always sees every table on
    `Base.metadata` without needing a separate trigger here."""
