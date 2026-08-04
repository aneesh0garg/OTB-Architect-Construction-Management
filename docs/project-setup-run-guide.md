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

The realm also includes a local-only contractor collaborator for permission
testing: `pilot-contractor` / `pilot_contractor`. It cannot read a project until
an administrator explicitly adds its Keycloak user ID as a project collaborator.

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

On startup the API applies its ordered, transactional Phase 1 database
migrations exactly once and records each completed version in
`schema_migrations`. This makes a fresh local database repeatable and prevents
individual feature services from racing to create their own tables.

## P1.1 project-record API

All endpoints below are tenant-scoped and require the same `Authorization`
header used in the quick check. `PROJECT_ID` must be an ID returned from
`GET /v1/workspace`.

| Endpoint                                                                      | Purpose                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /v1/workspace/projects/:projectId/record`                                | Read project metadata, tasks, document revisions, and filed communications.                                                                |
| `POST /v1/workspace/projects/:projectId/status`                               | Transition a project through planning, active, on-hold, closed, and archived states; closing sets a seven-year retention date.             |
| `POST /v1/workspace/projects/:projectId/stage`                                | Set an auditable delivery stage: pursuit through warranty/defects, including construction administration and handover.                     |
| `POST /v1/workspace/projects/:projectId/collaborators`                        | Grant a contractor, consultant, owner, vendor, member, or field-supervisor explicit project access.                                        |
| `DELETE /v1/workspace/projects/:projectId/collaborators/:userId`              | Revoke an external collaborator’s project access immediately and record the removal in the audit trail.                                    |
| `GET /v1/projects/:projectId/search?q=:query`                                 | Search permitted documents, filed communications, tasks, field observations, and workflow records within a project.                        |
| `GET /v1/projects/:projectId/exports/project.csv`                             | Download an audit-recorded, spreadsheet-safe project-record CSV.                                                                           |
| `GET /v1/projects/:projectId/exports/commercial.csv`                          | Download an audit-recorded, spreadsheet-safe commercial and cost-control CSV.                                                              |
| `POST /v1/workspace/projects/:projectId/tasks`                                | Create a task; an assigned user receives an in-app notification.                                                                           |
| `POST /v1/workspace/projects/:projectId/tasks/:taskId/status`                 | Move a task from open through in-progress/blocked to completed or cancelled; every valid transition is audited.                            |
| `POST /v1/workspace/projects/:projectId/documents`                            | Register a controlled document or drawing revision. A newly issued revision supersedes the previously issued revision for the same number. |
| `POST /v1/workspace/projects/:projectId/documents/uploads`                    | Prepare a 15-minute direct S3/MinIO upload for a PDF, JPEG, or PNG.                                                                        |
| `POST /v1/workspace/projects/:projectId/documents/uploads/batch`              | Prepare up to 20 controlled direct uploads in one request; each file receives its own verified upload ID and signed URL.                   |
| `POST /v1/workspace/projects/:projectId/documents/uploads/:uploadId/complete` | Verify the uploaded object before it can be attached to a revision.                                                                        |
| `GET /v1/workspace/projects/:projectId/documents/:documentId/download`        | Prepare a five-minute, permission-checked signed download for an uploaded original.                                                        |
| `POST /v1/workspace/projects/:projectId/communications`                       | File an immutable inbound, outbound, or internal project message.                                                                          |
| `GET /v1/workspace/notifications`                                             | Read the current user’s in-app notification feed.                                                                                          |
| `POST /v1/workspace/notifications/:notificationId/read`                       | Mark a notification as read.                                                                                                               |
| `GET /v1/workspace/audit?projectId=:projectId`                                | Read up to 200 tenant audit events, optionally narrowed to a project; organization administrators and principals only.                     |

Task assignments, issued construction workflows, invoice issuance, and payment
receipts create in-app notifications for authorized project members. External
email and push delivery remain explicitly opt-in integrations; notification
contents never substitute for the underlying project record.

Project delivery stages are distinct from record-retention status. The accepted
stages are `pursuit`, `concept`, `schematic_design`, `design_development`,
`construction_documents`, `tender`, `construction_administration`, `handover`,
`warranty_defects`, and `archived`. Each change records its prior and next stage
in the project audit trail; status still governs active/on-hold/closed/archive
retention.

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

For a file-backed revision, first prepare the upload, PUT the bytes to the
returned `uploadUrl` with the declared `Content-Type`, complete the upload, and
pass its `uploadId` to the document-revision endpoint. This prevents a caller
from attaching an arbitrary storage key from another tenant or project.

For a batch, post `{"files":[{"fileName":"A-101.pdf","contentType":"application/pdf","size":123}]}`
to the batch endpoint. All file descriptors are validated before any signed URLs
are prepared; the response has one upload ID and URL per file. Each uploaded
file still must be completed and attached individually, preserving size/type
verification and a separate immutable revision record.

Document revisions support optional `discipline`, `building`, `floor`, and
`zone` fields alongside their stable number, type, title, revision, status, and
issue date. These fields make a drawing or report identifiable in a multi-level
site context and remain attached to each immutable revision.

In the web workspace, the enabled **Drawings** tab opens a file-backed drawing
inside a controlled 2D viewer. It first requests the same permission-checked,
five-minute signed URL shown above; the viewer never exposes a storage key and
shows a clear message for a revision without an original or after access has
changed. PDFs and uploaded drawing images render in the browser, and the user
can explicitly open the signed original in a separate tab.

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
SQLite record first, so a capture survives an app restart; the sync indicator
makes local, syncing, synced, failed, and conflict states explicit. The current
mobile app uses Keycloak Authorization Code + PKCE, stores its short-lived
access token in the device secure store, and submits its queue only after an
authenticated project session is available. The API’s `clientCaptureId`
deduplicates retries when the app submits the draft.

For a physical device, copy `apps/mobile/.env.example` to
`apps/mobile/.env` and replace the example LAN address with the computer’s
LAN-reachable address. `localhost` only works for a simulator that maps it to
the development machine. Tap the `IN` avatar in Field work to sign in; after a
successful sign-in it shows the selected project and a pending capture can be
synced with **Sync now**.

## P1.2a pipeline and proposal conversion

Pipeline is tenant-scoped firm operations, separate from the project workspace.
Only organization administrators, principals, and project managers can manage
it. A conversion is transactional: it either creates the project, its initial
phases, initial allocations, project-manager membership, and the winning
opportunity link together, or persists none of them.

| Endpoint                                                   | Purpose                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /v1/pipeline`                                         | List the organization’s opportunities with proposal versions and proposal phases.                   |
| `POST /v1/pipeline/opportunities`                          | Create a lead/opportunity with client, anticipated fee, probability, targets, and next action.      |
| `POST /v1/pipeline/opportunities/:opportunityId/proposals` | Create a versioned proposal with scope, assumptions, exclusions, fee, phases, and initial staffing. |
| `POST /v1/pipeline/opportunities/:opportunityId/convert`   | Convert a chosen proposal into a project without re-entering the client, fee phases, or staffing.   |

`convert` accepts a `proposalId`, unique `projectCode`, optional `location`,
and project `stage`. It marks the chosen proposal as accepted and the
opportunity as won; the resulting project retains the client name for invoices
and accounting mappings. The original proposal remains an immutable commercial
record and all creation/conversion actions are captured in the organization
audit trail.

## P1.2b contacts directory

The shared contacts directory keeps clients, consultants, vendors, and owner
representatives as tenant records rather than repeating their details in project
notes. Contacts can be searched by name, company, or email and linked to a
project with an explicit relationship such as `Structural consultant` or
`Owner representative`.

| Endpoint                                | Purpose                                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| `GET /v1/contacts?q=:query`             | List up to 200 tenant contacts and their project relationships.      |
| `POST /v1/contacts`                     | Create or update a contact; non-null email is deduplicated per firm. |
| `POST /v1/contacts/:contactId/projects` | Add an auditable project relationship.                               |

Contact changes and relationship changes require a manager role and are written
to the organization audit log. Project guests cannot administer firm contacts.

## P1.3 commercial control API

The commercial module is a provider-neutral project ledger. It is ready to map
approved invoice, payment, client, and project references to Zoho Books without
making the application ledger dependent on a connector.

| Endpoint                                                              | Purpose                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `POST /v1/projects/:projectId/finance/phases`                         | Create a fee and target-hours project phase.                              |
| `POST /v1/projects/:projectId/finance/allocations`                    | Allocate a staff member to a phase and date range.                        |
| `POST /v1/projects/:projectId/finance/time`                           | Record project time; managers can submit, approve, and lock it.           |
| `POST /v1/projects/:projectId/finance/invoices`                       | Create a GST-ready invoice from explicit source lines.                    |
| `POST /v1/projects/:projectId/finance/invoices/:invoiceId/payments`   | Track payment receipt and automatically update paid/partially-paid state. |
| `GET /v1/projects/:projectId/finance`                                 | Read phases, allocations, time, invoices, payments, and fee/hours health. |
| `GET /v1/projects/:projectId/finance/cost`                            | Read owner cost budgets, commitments, change events, and forecast health. |
| `POST /v1/projects/:projectId/finance/budgets`                        | Establish a cost-code budget baseline.                                    |
| `POST /v1/projects/:projectId/finance/commitments`                    | Record a vendor commitment and its approved amount.                       |
| `POST /v1/projects/:projectId/finance/change-events`                  | Register a potential cost change.                                         |
| `POST /v1/projects/:projectId/finance/change-events/:changeId/status` | Submit, approve, or reject a cost change.                                 |

Invoices carry subtotal, GST rate and GST amount independently, and source-line
metadata preserves the link back to a fixed-fee milestone, approved time,
reimbursable, or change event. Only organization administrators, principals,
and finance administrators can create invoices, transition their status, or
record payments.

The owner-cost register is separate from the professional-services ledger:
baseline budgets, approved commitments, and approved change events produce an
explicit forecast-at-completion and variance. This keeps Phase 1 useful for
project cost control without becoming a payroll or general-contractor ERP.

## Zoho Books connection and invoice sync

Zoho Books is the India-first accounting connector. It is opt-in and remains
disabled until its OAuth client and Zoho organization ID are configured in
`.env`:

```bash
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_REDIRECT_URI=http://localhost:3001/v1/integrations/zoho-books/callback
ZOHO_ORGANIZATION_ID=...
INTEGRATION_TOKEN_KEY=<long random secret>
```

| Endpoint                                                                   | Purpose                                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `GET /v1/integrations/zoho-books`                                          | List authorized accounting connections without credentials.    |
| `POST /v1/integrations/zoho-books/connect`                                 | Start the Zoho OAuth consent flow.                             |
| `GET /v1/integrations/zoho-books/callback`                                 | Complete OAuth and store the encrypted refresh token.          |
| `POST /v1/projects/:projectId/finance/invoices/:invoiceId/accounting-sync` | Sync an invoice to a Zoho customer using `{"customerId":"…"}`. |
| `POST /v1/integrations/zoho-books/:connectionId/disconnect`                | Disconnect future accounting synchronization.                  |

Invoice sync records an external invoice ID on success. On failure it leaves the
application ledger intact, marks its accounting sync status as failed, stores a
bounded error message, and writes an audit event so an authorized user can retry
after resolving the connection or customer mapping.

## P1.3 people and capacity API

| Endpoint                                                   | Purpose                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /v1/resources/people`                                 | Read the tenant’s people directory.                                                 |
| `GET /v1/resources/teams`                                  | Read each tenant team with its registered people and team roles.                    |
| `POST /v1/resources/people`                                | Create or update a person’s display name, title, active state, and weekly capacity. |
| `POST /v1/resources/team-members`                          | Assign a registered person to an existing team.                                     |
| `GET /v1/resources/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD` | Compare each person’s date-range capacity with overlapping planned allocations.     |

Only organization administrators, principals, and project managers can change
the people directory or team assignments. Capacity remains transparent: it is
calculated from the person’s stated weekly hours and scheduled allocations, not
from hidden utilization assumptions.

`GET /v1/workspace/projects/:projectId/record` includes the permitted project
roster (user ID, recorded role, and directory name where available); the
workspace header uses it instead of a static avatar list. A dedicated
`GET /v1/workspace/projects/:projectId/collaborators` endpoint returns the same
roster for clients that need it without loading the entire project record.

## P1.4 governed Project Brain

Project Brain is disabled by default. An organization administrator or principal
must opt in before project retrieval or drafting is available:

```bash
curl -X POST http://localhost:3001/v1/ai/settings \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true}'
```

| Endpoint                                                     | Purpose                                                                                                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/projects/:projectId/brain/search?q=...`             | Permission-aware retrieval from filed communications, document revisions, workflow records, observations, and tasks, with source citations.                    |
| `POST /v1/projects/:projectId/brain/drafts`                  | Create an evidence-backed, review-required RFI, site report, meeting-minutes, risk-summary, submittal-review, document-classification, or record-search draft. |
| `POST /v1/projects/:projectId/brain/drafts/:draftId/approve` | Record explicit human approval. Approval does not itself issue a contractual project record.                                                                   |
| `POST /v1/projects/:projectId/brain/drafts/:draftId/reject`  | Record explicit human rejection; a reviewed draft cannot be issued by this endpoint.                                                                           |

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

| Endpoint                                                             | Purpose                                                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /v1/integrations/gmail`                                         | List organization-authorized Gmail connections without returning credentials.                   |
| `POST /v1/integrations/gmail/connect`                                | Create a one-time OAuth state and return the Google authorization URL.                          |
| `GET /v1/integrations/gmail/callback`                                | Exchange the authorization code and store the encrypted refresh token.                          |
| `POST /v1/integrations/gmail/:connectionId/disconnect`               | Stop future synchronization without deleting already filed project records.                     |
| `GET /v1/integrations/gmail/:connectionId/messages`                  | Browse up to 25 messages on demand; an optional `q` uses Gmail search syntax.                   |
| `POST /v1/integrations/gmail/:connectionId/messages/:messageId/file` | File one selected Gmail message into a project record using `{"projectId":"…"}`.                |
| `POST /v1/integrations/gmail/:connectionId/messages/send`            | Send and file an outbound project email using `projectId`, `recipients`, `subject`, and `body`. |

The requested scopes are read-only, compose, and send. The implementation does
not import an entire mailbox by default. Email becomes part of the project record
only through explicit user filing; the existing communications endpoint retains
its project link, Gmail thread/message identifiers, and filing audit trail. A
selected Gmail message can be filed repeatedly without creating a duplicate
project communication.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Before committing, run `git diff --check`. CI repeats formatting, linting,
type-checking, and tests for each change.

## End-to-end Phase 1 smoke test

After the API and local Docker services are running, execute:

```bash
pnpm smoke:phase1
```

The smoke test creates one `SMK-*` project and verifies the connected project
record, document supersession, duplicate-safe email/mobile retries, RFI issue,
invoice/payment control, and cited AI draft approval. It does not call Gmail or
Zoho because those require real third-party OAuth credentials; their endpoints
remain explicitly configuration-gated.
