from fastapi import Request, status
from fastapi.responses import JSONResponse


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


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )
