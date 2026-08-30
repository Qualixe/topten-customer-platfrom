from pydantic import BaseModel, field_validator

from app.common.credentials import PlainFieldStatus, SecretFieldStatus


class PathaoCredentialsStatus(BaseModel):
    client_id: PlainFieldStatus
    client_secret: SecretFieldStatus
    username: PlainFieldStatus
    password: SecretFieldStatus
    store_id: PlainFieldStatus
    # Whether dispatching hits Pathao's sandbox or its real, live API —
    # defaults true (sandbox) until an admin deliberately turns it off.
    sandbox: bool


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
    store_id: str | None = None
    sandbox: bool | None = None

    @field_validator("client_id", "client_secret", "username", "password", "store_id")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class PathaoLocation(BaseModel):
    id: int
    name: str


class PathaoLocationsResponse(BaseModel):
    success: bool = True
    data: list[PathaoLocation]
    meta: dict = {}
