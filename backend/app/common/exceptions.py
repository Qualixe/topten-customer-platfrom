import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")


class AppException(Exception):
    """Base exception for application-level errors that map to an HTTP response."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppException):
    """Raised when a requested resource does not exist."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class ValidationAppError(AppException):
    """Raised for request-level validation failures outside Pydantic's own
    validation (e.g. an uploaded file with the wrong extension/content)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)


class UnauthorizedError(AppException):
    """Raised when a request has no valid, active-user access token."""

    def __init__(self, message: str = "Not authenticated") -> None:
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(AppException):
    """Raised when an authenticated user's role lacks a required permission."""

    def __init__(self, message: str = "You do not have permission to do this") -> None:
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


async def request_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Formats a request body that fails Pydantic's own validation (e.g. a
    `@field_validator` raising `ValueError`, or a plain missing/wrong-type
    field) as the same `{"detail": "<string>"}` shape `app_exception_handler`
    already produces. Without this, FastAPI's default body — `detail` as a
    list of `{loc, msg, type}` objects — breaks every frontend caller that
    expects `detail` to be a plain string (see lib/api/client.ts), showing
    "[object Object]" instead of the actual message."""
    messages: list[str] = []
    for error in exc.errors():
        msg = str(error.get("msg", "Invalid value"))
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, ") :]
        loc = error.get("loc", ())
        field = next((str(part) for part in reversed(loc) if part != "body"), None)
        messages.append(f"{field}: {msg}" if field else msg)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "; ".join(messages) or "Invalid request"},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Full traceback goes to the server log only — the client always gets
    # the same generic message, never the exception details, SQL, or paths.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )
