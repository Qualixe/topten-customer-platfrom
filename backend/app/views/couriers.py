from pydantic import BaseModel, field_validator

from app.common.credentials import PlainFieldStatus, SecretFieldStatus


class PathaoCredentialsStatus(BaseModel):
    client_id: PlainFieldStatus
    client_secret: SecretFieldStatus
    username: PlainFieldStatus
    password: SecretFieldStatus


class PathaoCredentialsResponse(BaseModel):
    success: bool = True
    data: PathaoCredentialsStatus
    meta: dict = {}


class PathaoCredentialsUpdate(BaseModel):
    """PATCH-style body — omitted fields are left unchanged; a field sent as
    blank/null clears it."""

    client_id: str | None = None
    client_secret: str | None = None
    username: str | None = None
    password: str | None = None

    @field_validator("client_id", "client_secret", "username", "password")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None
