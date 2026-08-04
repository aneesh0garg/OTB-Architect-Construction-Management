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

## Signing in to the local web workspace

Open `http://localhost:3000`, select **Sign in**, and use the local pilot
account above at Keycloak. The web client uses the Authorization Code flow with
PKCE; the resulting access token lives only in the browser session and is used
to call the tenant-scoped API. Selecting **Sign out** clears that session token.

The workspace is intentionally viewable as a demo without signing in, but any
API-backed action requires a valid local Keycloak session. `WEB_ORIGIN` defines
the CORS allow-list for local web development.

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

## P1.2 field and execution API

The mobile field screen makes local capture and its sync status visible. The
server accepts idempotent field captures through a client capture ID, so a
device can retry safely after a connectivity interruption.

| Endpoint                                                       | Purpose                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /v1/projects/:projectId/field-visits`                    | Create or retry a site-visit capture with attendees, weather, checklist, notes, and sync state.             |
| `POST /v1/projects/:projectId/observations`                    | Create or retry an observation with location, trade, priority, evidence metadata, assignee, and sync state. |
| `POST /v1/projects/:projectId/workflows`                       | Create an RFI, submittal, site instruction, meeting minutes, or decision record.                            |
| `POST /v1/projects/:projectId/workflows/:recordId/transitions` | Apply an auditable, state-model-validated workflow transition.                                              |
| `GET /v1/projects/:projectId/execution-register`               | Read field and construction-administration registers.                                                       |

Start the mobile field app with `pnpm --filter @orbita/mobile dev`, then use
Expo Go or an iOS/Android simulator. “Capture observation” saves a device-local
draft first; the sync indicator makes local, syncing, synced, failed, and
conflict states explicit. The API’s `clientCaptureId` deduplicates retries when
the mobile sync adapter submits the draft.

## P1.3 commercial control API

The commercial module is a provider-neutral project ledger. It is ready to map
approved invoice, payment, client, and project references to Zoho Books without
making the application ledger dependent on a connector.

| Endpoint                                                            | Purpose                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `POST /v1/projects/:projectId/finance/phases`                       | Create a fee and target-hours project phase.                              |
| `POST /v1/projects/:projectId/finance/allocations`                  | Allocate a staff member to a phase and date range.                        |
| `POST /v1/projects/:projectId/finance/time`                         | Record project time; managers can submit, approve, and lock it.           |
| `POST /v1/projects/:projectId/finance/invoices`                     | Create a GST-ready invoice from explicit source lines.                    |
| `POST /v1/projects/:projectId/finance/invoices/:invoiceId/payments` | Track payment receipt and automatically update paid/partially-paid state. |
| `GET /v1/projects/:projectId/finance`                               | Read phases, allocations, time, invoices, payments, and fee/hours health. |

Invoices carry subtotal, GST rate and GST amount independently, and source-line
metadata preserves the link back to a fixed-fee milestone, approved time,
reimbursable, or change event. Only organization administrators, principals,
and finance administrators can create invoices, transition their status, or
record payments.

## P1.4 governed Project Brain

Project Brain is disabled by default. An organization administrator or principal
must opt in before project retrieval or drafting is available:

```bash
curl -X POST http://localhost:3001/v1/ai/settings \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true}'
```

| Endpoint                                                     | Purpose                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/projects/:projectId/brain/search?q=...`             | Permission-aware retrieval from filed communications, document revisions, workflow records, observations, and tasks, with source citations. |
| `POST /v1/projects/:projectId/brain/drafts`                  | Create an evidence-backed, review-required RFI, site report, meeting-minutes, or risk-summary draft.                                        |
| `POST /v1/projects/:projectId/brain/drafts/:draftId/approve` | Record explicit human approval. Approval does not itself issue a contractual project record.                                                |

The current local implementation produces cited review briefs without sending
customer data to an external model provider. It records setting changes,
policy checks, retrievals, draft creation, and approvals in the AI audit table.
Adding a model provider requires a separate provider configuration, data-
processing review, prompt/output retention control, and evaluation gate.

## Gmail / Google Workspace connection

Gmail is opt-in by organization and is not configured in a fresh local clone.
Create an OAuth 2.0 web client in the Google Cloud project, configure its
consent screen and redirect URI, then set these values in `.env`:

```bash
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=http://localhost:3001/v1/integrations/gmail/callback
INTEGRATION_TOKEN_KEY=<long random secret>
```

`INTEGRATION_TOKEN_KEY` is required before a refresh token can be stored. The
API encrypts refresh tokens with AES-256-GCM and short-lived OAuth state expires
after ten minutes.

| Endpoint                                               | Purpose                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `GET /v1/integrations/gmail`                           | List organization-authorized Gmail connections without returning credentials. |
| `POST /v1/integrations/gmail/connect`                  | Create a one-time OAuth state and return the Google authorization URL.        |
| `GET /v1/integrations/gmail/callback`                  | Exchange the authorization code and store the encrypted refresh token.        |
| `POST /v1/integrations/gmail/:connectionId/disconnect` | Stop future synchronization without deleting already filed project records.   |

The requested scopes are read-only, compose, and send. The implementation does
not import an entire mailbox by default. Email becomes part of the project record
only through explicit user filing; the existing communications endpoint retains
its project link, Gmail thread/message identifiers, and filing audit trail.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Before committing, run `git diff --check`. CI repeats formatting, linting,
type-checking, and tests for each change.
