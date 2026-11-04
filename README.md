# WEB Project Hub

A full-stack dashboard for tracking projects, monitoring progress, and exporting reports.

## Features

- Project overview with status summaries and charts
- Kanban board and searchable project table
- User accounts with private project data
- Scheduled project snapshots
- PDF, CSV, and JSON exports

## Tech stack

- **Frontend:** React, TypeScript, Vite, and Recharts
- **Backend:** Django REST Framework and JWT authentication
- **Services:** PostgreSQL, Redis, and Celery

## Quick start

You need Docker Desktop with Docker Compose.

```sh
cp .env.example .env
docker compose up --build
```

Open the dashboard at [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:8001/api/health/](http://localhost:8001/api/health/), and Django admin is at [http://localhost:8001/admin/](http://localhost:8001/admin/).

Docker Compose starts the frontend, API, PostgreSQL, Redis, a Celery worker, and Celery Beat.

## Local development

Run PostgreSQL and Redis with Docker:

```sh
docker compose up -d db redis
```

In one terminal, install the backend dependencies and start Django:

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL=postgresql://projecthub:projecthub@localhost:5432/projecthub
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/1
python manage.py migrate
python manage.py runserver 0.0.0.0:8001
```

WeasyPrint's system dependencies must also be installed for your operating system to generate PDF reports.

In another terminal, start the frontend:

```sh
cd frontend
npm ci
npm run dev
```

Vite forwards `/api` requests to `http://localhost:8001`. Set `VITE_DEV_API_TARGET` if the API uses a different address.

## Configuration

Copy `.env.example` to `.env` before starting Docker Compose. Its values are for local development; use unique secrets and passwords for any deployed environment.
