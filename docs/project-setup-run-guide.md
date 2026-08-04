# Orbita local setup and run guide

This guide starts the complete local Phase 1 foundation: the web workspace, API,
PostgreSQL, Redis, MinIO, and Keycloak.

## Prerequisites

- Node.js 22 or later
- Docker Desktop with Docker Compose
- pnpm 10.12.1. If Corepack is unavailable, use `npm exec pnpm@10.12.1 --` in
  place of `pnpm`.

## First run

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm dev
```

The long-running development processes can also be started separately:

```bash
pnpm --filter @orbita/web dev
pnpm --filter @orbita/api dev
pnpm --filter @orbita/mobile start
```

## Local services

| Service       | URL                            | Purpose                               |
| ------------- | ------------------------------ | ------------------------------------- |
| Web workspace | `http://localhost:3000`        | Teams-like project delivery workspace |
| API health    | `http://localhost:3001/health` | API liveness check                    |
| Keycloak      | `http://localhost:8180`        | Local OIDC identity and authorization |
| MinIO console | `http://localhost:9001`        | Local S3-compatible document storage  |
| PostgreSQL    | `localhost:5432`               | Tenant and project data               |
| Redis         | `localhost:6379`               | Queue/cache foundation                |

## Pilot account

The imported local realm contains a development-only user:

| Field              | Value                |
| ------------------ | -------------------- |
| Username           | `pilot-admin`        |
| Password           | `pilot_local`        |
| Organization claim | `northline-studio`   |
| Role               | `organization_admin` |

These credentials exist only for local development. Do not use them in a pilot,
staging, or production environment.

## Workspace API quick check

The workspace API requires a Keycloak access token. The following obtains a
local token, creates the pilot organization and team, and reads the resulting
tenant workspace:

```bash
ACCESS_TOKEN=$(curl -sS -X POST 'http://localhost:8180/realms/orbita/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password&client_id=orbita-web&username=pilot-admin&password=pilot_local' \
  | node -e "let body='';process.stdin.on('data',c=>body+=c).on('end',()=>process.stdout.write(JSON.parse(body).access_token))")

curl -X POST http://localhost:3001/v1/workspace/organization \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Northline Studio"}'

curl -X POST http://localhost:3001/v1/workspace/teams \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Construction administration"}'

curl http://localhost:3001/v1/workspace \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

The API will initialize the Phase 1 organization, team, project membership, and
audit tables on startup. Application migrations will replace this bootstrap
schema initialization before production deployment.

## P1.1 project-record API

All endpoints below are tenant-scoped and require the same `Authorization`
header used in the quick check. `PROJECT_ID` must be an ID returned from
`GET /v1/workspace`.

| Endpoint                                                | Purpose                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /v1/workspace/projects/:projectId/record`          | Read project metadata, tasks, document revisions, and filed communications.                                                                |
| `POST /v1/workspace/projects/:projectId/tasks`          | Create a task; an assigned user receives an in-app notification.                                                                           |
| `POST /v1/workspace/projects/:projectId/documents`      | Register a controlled document or drawing revision. A newly issued revision supersedes the previously issued revision for the same number. |
| `POST /v1/workspace/projects/:projectId/communications` | File an immutable inbound, outbound, or internal project message.                                                                          |
| `GET /v1/workspace/notifications`                       | Read the current user’s in-app notification feed.                                                                                          |
| `POST /v1/workspace/notifications/:notificationId/read` | Mark a notification as read.                                                                                                               |

Example: create an issued drawing revision.

```bash
curl -X POST "http://localhost:3001/v1/workspace/projects/$PROJECT_ID/documents" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "documentNumber": "A-204",
    "documentType": "drawing",
    "title": "Stair detail",
    "revision": "G",
    "status": "issued",
    "issueDate": "2026-03-12"
  }'
```

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Before committing, run `git diff --check`. CI repeats formatting, linting,
type-checking, and tests for each change.
