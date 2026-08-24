"""Password hashing and JWT access-token creation/verification.

Tokens are stateless (no revocation list, no refresh tokens) — "logout" is
purely the frontend discarding its copy of the token. That's a deliberate
simplification for a low-traffic internal admin tool, not an oversight; a
compromised token stays valid until it naturally expires
(`settings.JWT_EXPIRE_MINUTES`).
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        # A malformed/foreign hash (e.g. empty string) — never a match, and
        # never a crash that would leak which branch failed.
        return False


def create_access_token(*, user_public_id: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user_public_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Returns the decoded payload, or `None` for any invalid/expired/
    malformed token — callers never need to catch a jwt-specific exception."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
