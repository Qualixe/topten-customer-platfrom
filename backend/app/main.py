from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.common.exceptions import (
    AppException,
    app_exception_handler,
    request_validation_exception_handler,
    unhandled_exception_handler,
)
from app.core.config import settings
from app.router import api_router

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Only the branding and gift-image directories are served statically — never
# UPLOAD_DIR, which holds POS import files containing customer PII.
Path(settings.BRANDING_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount(
    "/branding", StaticFiles(directory=settings.BRANDING_UPLOAD_DIR), name="branding"
)

Path(settings.GIFT_IMAGE_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount(
    "/gift-images",
    StaticFiles(directory=settings.GIFT_IMAGE_UPLOAD_DIR),
    name="gift-images",
)
