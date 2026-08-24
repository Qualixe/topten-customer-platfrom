"""Unit tests for password hashing and JWT helpers — no database needed."""

from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.core.security import (
    JWT_ALGORITHM,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_password_does_not_return_the_plaintext() -> None:
    assert hash_password("correct horse battery staple") != "correct horse battery staple"


def test_verify_password_round_trip() -> None:
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed) is True


def test_verify_password_rejects_wrong_password() -> None:
    hashed = hash_password("correct horse battery staple")
    assert verify_password("wrong password", hashed) is False


def test_verify_password_rejects_malformed_hash() -> None:
    assert verify_password("anything", "not-a-real-bcrypt-hash") is False


def test_create_access_token_round_trips_through_decode() -> None:
    token = create_access_token(user_public_id="abc-123")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "abc-123"


def test_decode_access_token_rejects_garbage() -> None:
    assert decode_access_token("not-a-jwt") is None


def test_decode_access_token_rejects_expired_token() -> None:
    now = datetime.now(UTC)
    expired_payload = {
        "sub": "abc-123",
        "iat": now - timedelta(days=2),
        "exp": now - timedelta(days=1),
    }
    expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)
    assert decode_access_token(expired_token) is None


def test_decode_access_token_rejects_wrong_signing_key() -> None:
    now = datetime.now(UTC)
    payload = {"sub": "abc-123", "iat": now, "exp": now + timedelta(minutes=5)}
    other_secret_token = jwt.encode(payload, "a-different-secret", algorithm=JWT_ALGORITHM)
    assert decode_access_token(other_secret_token) is None
