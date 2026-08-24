# TopTen Customer Platform

Customer management and loyalty platform for TopTen Supermarket.

This repository currently contains the **project foundation only** — no business
features are implemented yet. It exists to give the team a clean, working
starting point (frontend, backend, database, and migrations wired together)
that can be extended in later phases.

## Tech Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend:** FastAPI + Python
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy
- **Migrations:** Alembic
- **Cache / queue broker:** Redis (wired for future use)
- **Background tasks:** Celery (wired for future use)

## Folder Structure

```text
topten-customer-platform/
│
├── frontend/                    # Next.js application (TypeScript, Tailwind, App Router)
│   └── app/
│       ├── layout.tsx
│       └── page.tsx
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entrypoint
│   │   │
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic Settings (env-based config)
│   │   │   └── security.py      # Reserved for future auth utilities
│   │   │
│   │   ├── database/
│   │   │   ├── database.py      # SQLAlchemy engine/session
│   │   │   ├── base.py          # Declarative Base for models
│   │   │   └── models/          # SQLAlchemy models (empty for now)
│   │   │
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py    # /api/v1 router aggregator
│   │   │       └── endpoints/
│   │   │           └── health.py
│   │   │
│   │   ├── modules/             # Future business modules (empty placeholders)
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── customers/
│   │   │   ├── imports/
│   │   │   ├── campaigns/
│   │   │   ├── birthdays/
│   │   │   ├── vip/
│   │   │   ├── gifts/
│   │   │   ├── couriers/
│   │   │   └── notifications/
│   │   │
│   │   └── common/
│   │       ├── exceptions.py    # Shared exception handlers
│   │       └── dependencies.py  # Shared FastAPI dependencies
│   │
│   ├── migrations/              # Alembic environment
│   ├── tests/
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml           # postgres + redis (with persistent volumes)
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 18.18+ and npm
- Python 3.12+ (tested with 3.13)
- Docker Desktop (for PostgreSQL and Redis)

## Setup

### 1. Clone and enter the project

```bash
cd topten-customer-platform
```

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 3. Backend setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then edit values if needed
```

### 4. Run database migrations

```bash
# from backend/, with venv activated
alembic upgrade head
```

There are no schema migrations yet (foundation phase only) — this step just
confirms Alembic can connect to PostgreSQL using `DATABASE_URL`.

### 5. Frontend setup

```bash
cd frontend
npm install
```

## Running the app

### Backend (FastAPI)

```bash
cd backend
.venv\Scripts\activate        # or: source .venv/bin/activate
uvicorn app.main:app --reload
```

- API base: http://localhost:8000
- Health check: http://localhost:8000/api/v1/health
- Swagger UI: http://localhost:8000/docs
- OpenAPI schema: http://localhost:8000/openapi.json

### Celery worker (background POS import processing)

```bash
cd backend
.venv\Scripts\activate        # or: source .venv/bin/activate
celery -A app.core.celery_app worker --loglevel=info
```

Requires `redis` running (`docker compose up -d redis`). The worker processes
jobs queued by `POST /api/v1/imports/customers`; without it running, uploads
stay in `UPLOADED` status indefinitely.

### Frontend (Next.js)

```bash
cd frontend
npm run dev
```

- App: http://localhost:3000

## Docker commands

```bash
docker compose up -d       # start postgres + redis in the background
docker compose ps          # check status
docker compose logs -f     # tail logs
docker compose down        # stop containers (volumes persist)
```

## Database migration commands (Alembic, run from backend/)

```bash
alembic revision -m "message"                # create an empty migration
alembic revision --autogenerate -m "message" # create migration from model changes
alembic upgrade head                         # apply all migrations
alembic downgrade -1                         # roll back one migration
alembic history                              # list migrations
```

## Testing

Backend tests run against a real PostgreSQL database (`topten_test`), not
mocks — the import suite specifically verifies constraint/upsert/transaction
behavior that a fake DB wouldn't exercise faithfully.

```bash
docker compose up -d postgres            # if not already running
docker exec topten-postgres psql -U postgres -c "CREATE DATABASE topten_test;"  # once

cd backend
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/topten_test \
  alembic upgrade head                   # once, or after new migrations

DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/topten_test \
  pytest -v
```

Every table is truncated before each test for isolation (see
`tests/conftest.py`); no Celery worker or Redis is required — tests call the
import pipeline's functions directly rather than going through the queue.

## Linting

```bash
# Backend
cd backend
ruff check app tests

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
```

## Environment Variables

`backend/.env.example`:

```env
DATABASE_URL=
REDIS_URL=
CORS_ORIGINS=
APP_ENV=development
```

Copy to `backend/.env` and fill in real values. Never commit `.env` files or
hardcode secrets — `.env` is already excluded via `.gitignore`.

## Completed in this phase

- Repository/folder structure for frontend, backend, and future modules
- FastAPI app with CORS, versioned API (`/api/v1`), global exception handling,
  and Swagger/OpenAPI docs enabled
- `GET /api/v1/health` endpoint, verified working
- Async SQLAlchemy (asyncpg) engine/session foundation, Alembic wired to app
  config (sync driver, derived from the same `DATABASE_URL`)
- Core customer schema: `Customer`, `CustomerMonthlySpending`, `ImportBatch`,
  `ImportRowError` — see `app/database/models/`
- POS customer import pipeline (`imports` module): phone-normalized matching
  (`phonenumbers`), chunked/streaming CSV processing, idempotent upserts, a
  Celery background task, and `POST/GET /api/v1/imports*` endpoints
- Celery wired to Redis (broker + result backend) for the import pipeline
- Empty placeholder packages for remaining future modules (`campaigns`,
  `birthdays`, `vip`, `gifts`, `couriers`, `notifications`, `auth`, `users`)
- Next.js app (TypeScript, App Router, Tailwind) with a simple status homepage
- `docker-compose.yml` for PostgreSQL and Redis with persistent volumes
- `.env.example`, `.gitignore`, Dockerfile, and this README
- Verified: backend imports cleanly, `pytest` passes (43 tests, including the
  full POS import suite), `ruff check` passes, frontend `tsc --noEmit` and
  `next lint` pass, and `next build` succeeds

## Recommended Phase 3

Do not implement yet — for planning only:

1. Basic authentication (login, JWT sessions) in the `auth` module
2. Customer profile collection flow (secure link, DOB, address)
3. Admin dashboard shell in the frontend
4. Notification integrations (SMS/email providers) — the frontend's
   Campaigns/Notifications pages are already UI-complete against mock data
5. VIP calculation and birthday automation, once real customer data exists
6. Courier integration
