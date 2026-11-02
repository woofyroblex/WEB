# WEB Project Hub

A small full-stack project dashboard built with React, TypeScript, Django REST Framework, and PostgreSQL. It includes JWT sign-in, project tracking, Recharts, PDF exports, and Celery background jobs scheduled by Celery Beat.

## Run the whole app

Requirements: Docker Desktop with Docker Compose.

```sh
cp .env.example .env
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173), create an account, and start adding projects. The API is available at [http://localhost:8001/api/health/](http://localhost:8001/api/health/); Django admin is at [http://localhost:8001/admin/](http://localhost:8001/admin/).

The compose stack starts PostgreSQL, Redis, the Django API, a Celery worker, Celery Beat, and the React dashboard. The dashboard calls the API through the frontend web server, so browser requests stay on one origin.

## Local development without Docker for the app

Start PostgreSQL and Redis with `docker compose up db redis`. Set the database and Redis URLs for the Django terminal, then run the services in separate terminals:

```sh
brew install weasyprint
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

```sh
cd frontend
npm ci
npm run dev
```

The Vite server forwards `/api` requests to `http://localhost:8001`. Set `VITE_DEV_API_TARGET` when the API runs at a different address. Set `VITE_API_BASE_URL` only when using a different API URL.

## Main API routes

- `POST /api/auth/register/` creates an account.
- `POST /api/auth/token/` returns a JWT access and refresh token.
- `GET|POST /api/projects/` lists or creates the signed-in user's projects.
- `GET|PATCH|DELETE /api/projects/{id}/` reads or updates one of the user's projects.
- `GET /api/dashboard/` returns counts for the chart and summary cards.
- `POST /api/dashboard/snapshot/` queues a Celery snapshot task.
- `GET /api/reports/projects.pdf` downloads a PDF of the signed-in user's projects.

Project routes require the `Authorization: Bearer <access-token>` header. Each account can only access its own projects and snapshots.

## Checks

GitHub Actions runs the frontend typecheck/build, backend lint and Django checks, database-backed backend tests, security scans, and Docker builds when their project files are present. The checks are defined in `.github/workflows/ci.yml`.
