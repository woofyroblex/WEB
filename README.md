# Project Hub

A simple project dashboard with separate user and admin access, backed by a Django API and PostgreSQL database.

## What it includes

- Login and registration pages with JWT authentication
- Regular users manage their own projects and statuses
- Admins see workspace totals and manage account roles
- Project summaries, search, and create, edit, and delete actions
- PostgreSQL storage with Redis and Celery services

## Run with Docker

You need Docker Desktop with Docker Compose.

```sh
cp .env.example .env
docker compose up --build
```

Open the dashboard at [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:8001/api/health/](http://localhost:8001/api/health/).

### Create the first admin

With the Docker Compose stack running, open another terminal and create a Django superuser:

```sh
docker compose exec backend python manage.py createsuperuser
```

That account receives the admin role and can sign in to the dashboard. New registrations always receive the user role. Admins can promote and demote eligible accounts from **User management**. The system prevents changing your own role or removing the last admin.

## Local development

Start PostgreSQL and Redis:

```sh
docker compose up -d db redis
```

Start the backend in one terminal:

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

Create an admin account with `python manage.py createsuperuser` from the backend directory.

Start the frontend in another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Vite forwards `/api` requests to `http://localhost:8001`. Set `VITE_DEV_API_TARGET` if the API uses another address. Install WeasyPrint's system dependencies if you need PDF reports.

## Roles and API

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `POST /api/auth/register/` | Public | Create a user account |
| `POST /api/auth/token/` | Public | Sign in and receive JWT tokens |
| `GET /api/auth/me/` | Signed in | Get the current account and role |
| `/api/projects/` | Signed in | Manage the current user's projects |
| `GET /api/dashboard/` | User | Get personal project totals |
| `GET /api/admin/dashboard/` | Admin | Get workspace totals |
| `GET /api/admin/users/` | Admin | List accounts and project counts |
| `PATCH /api/admin/users/{id}/role/` | Admin | Set an eligible account's role to `admin` or `user` |

The dashboard API only returns a user's own projects. Admin APIs provide workspace totals and account management; they do not expose project descriptions.

## Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Django REST Framework, Simple JWT
- **Database:** PostgreSQL
- **Background jobs:** Redis and Celery
