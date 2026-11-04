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

## Validation and pull requests

The required GitHub check is **CI passed**. It rejects failed setup, missing
project manifests, failed or cancelled checks, and workflow-policy regressions.
Frontend formatting, typechecking, behavior tests, builds, Python typing and
security checks, dependency audits, and fixable high/critical container findings
are enforced. Coverage reports are retained as workflow artifacts; Codecov upload
is optional and requires a configured `CODECOV_TOKEN` for this repository.

Run the frontend checks with:

```sh
cd frontend
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm run build
```

With backend development dependencies and PostgreSQL/WeasyPrint libraries
available, run `ruff check .`, `ruff format --check .`, `mypy .`,
`python manage.py makemigrations --check --dry-run`, and
`coverage run --source=config,projects manage.py test --noinput` from `backend`.
From the repository root, install `.github/requirements-ci.txt` and run
`python -m unittest discover -s scripts/tests -v` to validate automation policies.

AI and Dependabot automation waits for successful CI and merges only the exact
reviewed commit. AI approval requires a complete textual diff and a strictly
validated low-risk verdict. Infrastructure/dependency changes and incomplete
reviews require manual review. The bot scripts run from the PR's trusted base
branch, so their initial installation becomes active after these changes are
merged into that branch. GitHub Actions must be allowed to approve pull requests
in the repository's Actions settings for automated approvals to work.

An owner, member, or collaborator can request conflict resolution by posting
exactly `@ai-bot resolve conflicts` on a same-repository PR. Forks, stale revisions,
and conflicts in dependency files or infrastructure are refused. The resolver
requests CI for the resulting commit; it does not merge the PR. Configure
`GEMINI_API_KEY` as a repository secret and optionally set the `GEMINI_MODEL`
repository variable (default: `gemini-3.6-flash`).
