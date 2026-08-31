"""A minimal in-memory rate limiter — no new dependency, no Redis
coordination. This deployment runs a single app instance (see
deploy config), so a per-process fixed-window counter is sufficient;
swap for a Redis-backed limiter first if this ever scales to multiple
app processes/instances behind a load balancer.

Applied only to the handful of routes that are either unauthenticated
(public form submission, profile-completion links) or trigger a real-world
side effect an attacker would want to hammer (login, test SMS).
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import Request, status

from app.common.exceptions import AppException

_buckets: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


class RateLimitError(AppException):
    def __init__(self, message: str = "Too many requests. Please try again shortly.") -> None:
        super().__init__(message, status_code=status.HTTP_429_TOO_MANY_REQUESTS)


def _client_ip(request: Request) -> str:
    """The app is only ever reached through the nginx reverse proxy
    (backend/frontend containers aren't published to the host — see
    docker-compose.prod.yml), so `request.client.host` is always nginx's
    container IP, not the real visitor. nginx appends the real client IP as
    the LAST hop of X-Forwarded-For (proxy_add_x_forwarded_for) — anything
    earlier in that list came from the client itself and is spoofable, so
    only the last entry is trusted."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(key_prefix: str, *, max_requests: int, window_seconds: int):
    """FastAPI dependency factory — a fixed-window limiter keyed by
    `key_prefix` + client IP. Add as a route dependency:
    `Depends(rate_limit("login", max_requests=10, window_seconds=60))`.
    """

    def check(request: Request) -> None:
        key = f"{key_prefix}:{_client_ip(request)}"
        now = time.monotonic()
        cutoff = now - window_seconds

        with _lock:
            hits = _buckets[key]
            while hits and hits[0] < cutoff:
                hits.pop(0)
            if len(hits) >= max_requests:
                raise RateLimitError()
            hits.append(now)

    return check
