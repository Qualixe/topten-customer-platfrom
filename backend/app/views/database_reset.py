from datetime import datetime

from pydantic import BaseModel, field_validator

# Enforced server-side, not just as a frontend UX nicety — a direct API
# call must also type this exactly, so the "2-step" confirmation can't be
# bypassed by skipping the frontend.
REQUIRED_CONFIRMATION_PHRASE = "RESET"


class DatabaseResetRequest(BaseModel):
    confirm: str

    @field_validator("confirm")
    @classmethod
    def _must_match_phrase(cls, value: str) -> str:
        if value != REQUIRED_CONFIRMATION_PHRASE:
            raise ValueError(f'Type "{REQUIRED_CONFIRMATION_PHRASE}" exactly to confirm.')
        return value


class DatabaseResetResult(BaseModel):
    backup_file: str
    reset_at: datetime


class DatabaseResetResponse(BaseModel):
    success: bool = True
    data: DatabaseResetResult
    meta: dict = {}
