# Orbita local setup and run guide

This guide starts the complete local Phase 1 foundation: the web workspace, API,
PostgreSQL, Redis, MinIO, and Keycloak.

## Prerequisites

- Node.js 22 or later
- Docker Desktop with Docker Compose
- pnpm 10.12.1. If Corepack is unavailable, invoke it explicitly with
  `npm exec --yes --package=pnpm@10.12.1 -- pnpm` in place of `pnpm`.

## New contributor quick start

Follow this sequence on a new machine. It configures the full local stack,
including secure invitation email delivery, without committing any secrets.

```bash
cp .env.example .env
pnpm install
docker compose up -d
npm exec --yes --package=pnpm@10.12.1 -- pnpm setup:local-invitations
pnpm dev
```

The invitation setup command is safe to repeat. It creates the local-only Keycloak
provisioner client when necessary, grants only the required local user-management
roles, retrieves its generated secret into the ignored `.env`, and configures
Keycloak SMTP to use Mailpit. It never prints or stores that secret in Git.

Without Corepack, the equivalent commands are:

```bash
npm exec --yes --package=pnpm@10.12.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.12.1 -- pnpm setup:local-invitations
npm exec --yes --package=pnpm@10.12.1 -- pnpm dev
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
| Mailpit       | `http://localhost:8025`        | Local-only Keycloak invitation inbox  |
| MinIO console | `http://localhost:9001`        | Local S3-compatible document storage  |
| PostgreSQL    | `localhost:5432`               | Tenant and project data               |
| Redis         | `localhost:6379`               | Queue/cache foundation                |

## Verify your installation

1. Open `http://localhost:3000` and confirm the workspace loads.
2. Open `http://localhost:3001/health` and confirm the API reports healthy.
3. Open `http://localhost:8025` and confirm the Mailpit inbox loads.
4. Sign in at the workspace using `pilot-admin` / `pilot_local`.
5. In the mobile navigation, select **Team** → **Manage project team**. The
   Staffing & capacity dialog should display **Invite organization member**.

If Mailpit is unavailable, run `docker compose up -d mailpit` and refresh the
inbox. If Keycloak was already running, repeat `pnpm setup:local-invitations`;
it updates the existing realm in place.

## Organization member invitations and profile photos

From **Resource capacity**, an organization administrator invites a member using their
work email, name, role, and weekly capacity. Orbita creates or reuses the Keycloak
identity server-side, records a pending organization directory membership, and asks
Keycloak to send a seven-day activation email. The recipient verifies their email and
sets their own password; Orbita never creates, displays, or emails a password.

Local Docker Compose includes **Mailpit**, a safe email catcher comparable to Mailtrap.
Keycloak delivers local activation messages to `mailpit:1025`; open
`http://localhost:8025` to read an invitation and finish onboarding. No invitation
email leaves the development machine and no hosted email-account credentials are needed.

The local realm includes an `orbita-provisioner` service account. Automate the one-time
local setup after `docker compose up -d` with:

```bash
npm exec --yes --package=pnpm@10.12.1 -- pnpm setup:local-invitations
```

The command retrieves the generated secret from the running Keycloak container and writes
it only to the untracked root `.env`; it never prints the secret. It also configures the
existing local realm to send SMTP to Mailpit, so it works even when Keycloak was started
before this feature was added. Never commit that secret or expose it in the web or mobile
app. Production must use an approved transactional-email SMTP/API provider with equivalent
delivery controls.

### Test an invitation end to end

1. Sign in as `pilot-admin`.
2. Go to **Team** → **Manage project team** → **Invite organization member**.
3. Enter a unique local email address (for example `new.member@local.orbita`),
   name, role, and weekly capacity, then select **Send invitation**.
4. Open Mailpit at `http://localhost:8025`, open the newest Orbita message, and
   use the activation link in a private/incognito window or separate browser profile.
   If using the same browser as `pilot-admin`, select **Sign out of Keycloak** in
   the invitation confirmation before opening the link.
5. Complete email verification and choose a password in Keycloak.
6. Sign out and sign in as the invited member. Then assign the active directory
   member to a project from **Resource capacity**.

Mailpit does not deliver externally; any syntactically valid test address is safe.
Keycloak intentionally rejects an activation link when that browser has an SSO session
for a different account; this prevents one user from accidentally activating another
user’s credentials.

Members can upload a JPEG, PNG, or WebP profile photo (maximum 5 MB) from their profile
page. Uploads use a short-lived storage URL, are verified by the API, and are recorded in
the audit trail. A member may update their own photo; organization managers may update a
directory member’s photo.

### Test a profile photo

1. Open a member from the organization directory.
2. Select **Upload profile photo** and choose a JPEG, PNG, or WebP under 5 MB.
3. Confirm the photo replaces the initials avatar after the upload completes.
4. Refresh the page to confirm the persisted photo is loaded through a short-lived URL.

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

## Controlled documents and drawings

Documents receive a generated number by type (`DRW-0001`, `SPC-0001`, and so
on) and begin at revision `A`. To create a replacement, select the prior record
in **Supersede existing revision**; the next revision is generated automatically.
After the new revision is issued, the earlier issued revision with that document
number becomes **superseded**.

The governed workflow is **draft → internal review → approved → issued**.
Authors submit drafts for review; organization administrators, principals, and
project managers can approve or return them to draft. Review decisions and
issuance are retained in the project audit record. Issued documents can be
selected to create a numbered transmittal with recipients.

The Documents register supports search, status/type filtering, and sorting.
**Open original** appears only when a file is retained. Drawings use the review
workspace for annotations; on phones, PDFs open in the browser's native viewer
to provide reliable page navigation and controls.

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

| Endpoint                                                                      | Purpose                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/workspace/projects/:projectId/record`                                | Read project metadata, tasks, document revisions, and filed communications.                                                                                                 |
| `POST /v1/workspace/projects/:projectId/status`                               | Transition a project through planning, active, on-hold, closed, and archived states; closing sets a seven-year retention date.                                              |
| `POST /v1/workspace/projects/:projectId/stage`                                | Set an auditable delivery stage: pursuit through warranty/defects, including construction administration and handover.                                                      |
| `POST /v1/workspace/projects/:projectId/collaborators`                        | Grant a contractor, consultant, owner, vendor, member, or field-supervisor explicit project access.                                                                         |
| `DELETE /v1/workspace/projects/:projectId/collaborators/:userId`              | Revoke an external collaborator’s project access immediately and record the removal in the audit trail.                                                                     |
| `GET /v1/projects/:projectId/search?q=:query`                                 | Search permitted documents, filed communications, tasks, field observations, and workflow records within a project.                                                         |
| `GET /v1/projects/:projectId/exports/project.csv`                             | Download an audit-recorded, spreadsheet-safe project-record CSV.                                                                                                            |
| `GET /v1/projects/:projectId/exports/commercial.csv`                          | Download an audit-recorded, spreadsheet-safe commercial and cost-control CSV.                                                                                               |
| `GET /v1/projects/:projectId/exports/project.json`                            | Download an audit-recorded, non-proprietary `orbita-project-record/v1` manifest with project records and audit events.                                                      |
| `POST /v1/workspace/projects/:projectId/tasks`                                | Create a task; an assigned user receives an in-app notification.                                                                                                            |
| `POST /v1/workspace/projects/:projectId/tasks/:taskId/status`                 | Move a task from open through in-progress/blocked to completed or cancelled; every valid transition is audited.                                                             |
| `POST /v1/workspace/projects/:projectId/documents`                            | Register a controlled document or drawing revision. A newly issued revision supersedes the previously issued revision for the same number.                                  |
| `POST /v1/workspace/projects/:projectId/documents/uploads`                    | Prepare a 15-minute direct S3/MinIO upload for a PDF, JPEG, or PNG.                                                                                                         |
| `POST /v1/workspace/projects/:projectId/documents/uploads/batch`              | Prepare up to 20 controlled direct uploads in one request; each file receives its own verified upload ID and signed URL.                                                    |
| `POST /v1/workspace/projects/:projectId/documents/uploads/:uploadId/complete` | Verify the uploaded object before it can be attached to a revision.                                                                                                         |
| `POST /v1/workspace/projects/:projectId/transmittals`                         | Create an immutable receipt record for selected issued documents, recipients, purpose, and issue note.                                                                      |
| `GET /v1/workspace/projects/:projectId/documents/:documentId/download`        | Prepare a five-minute, permission-checked signed download for an uploaded original.                                                                                         |
| `GET /v1/workspace/projects/:projectId/documents/:documentId/annotations`     | Read access-checked drawing comments and optional page pins.                                                                                                                |
| `POST /v1/workspace/projects/:projectId/documents/:documentId/annotations`    | Add an audited drawing comment with optional page and x/y percentage pin coordinates.                                                                                       |
| `POST /v1/workspace/projects/:projectId/communications`                       | File an immutable inbound, outbound, or internal project message.                                                                                                           |
| `GET /v1/workspace/notifications`                                             | Read the current user’s in-app notification feed.                                                                                                                           |
| `GET /v1/workspace/my-tasks`                                                  | Read the signed-in user’s assigned tasks across projects they are permitted to access.                                                                                      |
| `POST /v1/workspace/notifications/:notificationId/read`                       | Mark a notification as read.                                                                                                                                                |
| `GET /v1/workspace/notification-preferences`                                  | Read the signed-in user’s saved delivery preferences.                                                                                                                       |
| `PUT /v1/workspace/notification-preferences`                                  | Save an event-specific or `*` default preference. Supports in-app/email opt-in, paired `HH:mm` quiet hours, and `immediate`, `daily`, `weekly`, or `none` digest selection. |
| `GET /v1/workspace/audit?projectId=:projectId`                                | Read up to 200 tenant audit events, optionally narrowed to a project; organization administrators and principals only.                                                      |

Task assignments, issued construction workflows, invoice issuance, and payment
receipts create in-app notifications for authorized project members. External
email and push delivery remain explicitly opt-in integrations; notification
contents never substitute for the underlying project record.

The JSON package includes project metadata, tasks, document metadata, filed
communications, observations, workflows, and the project-scoped audit trail.
It deliberately excludes storage keys and original file bytes; recipients can
use the normal permission-checked document-download endpoint to obtain each
original independently. This keeps a portable record export from becoming a
long-lived, unrestricted attachment share.

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

Completion also reads the controlled object once and records a SHA-256 checksum.
That checksum is copied into the attached immutable document revision, providing
a local integrity-processing proof before later malware-scanning or OCR workers
are introduced.

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

Observation discussions are project-scoped, auditable, and safe to retry from
an offline client using a `clientCommentId`. Field users can add a comment
locally; the mobile sync queue creates the observation first, then its pending
comments.

The mobile **Capture observation** sheet also stores the description, location,
category, trade, priority, optional due date, and evidence/drawing references
before it attempts network sync. It can capture or select photos after the
device permission is granted, retaining the device URI only on the phone. The
current sync payload sends safe photo metadata (type, label, timestamp), not a
local URI or image bytes. Controlled binary upload, malware scanning, and OCR
remain a separate file-processing increment.

| Endpoint                                                            | Purpose                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /v1/projects/:projectId/observations/:observationId/comments`  | Return the permitted observation discussion in chronological order.              |
| `POST /v1/projects/:projectId/observations/:observationId/comments` | Create or retry a comment with `body` and optional idempotent `clientCommentId`. |

The mobile field screen makes local observation and site-visit capture, plus
their sync status, visible. The server accepts idempotent field captures
through a client capture ID, so a device can retry safely after a connectivity
interruption.

A synchronized field observation can create a linked task, RFI draft, site-instruction draft, or selected-observation site-visit report. The mobile app never issues a contractual workflow: RFI and instruction records remain drafts for a permitted web coordinator to complete, review, and issue.

| Endpoint                                                       | Purpose                                                                                                                                                                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/projects/:projectId/field-visits`                    | Create or retry a site-visit capture with attendees, weather, checklist, notes, and sync state.                                                                                                                       |
| `POST /v1/projects/:projectId/observations`                    | Create or retry an observation with location, trade, priority, evidence metadata, assignee, and sync state.                                                                                                           |
| `POST /v1/projects/:projectId/workflows`                       | Create an RFI, submittal, site instruction, meeting minutes, site-visit report, or decision record. A site-visit report must reference one project visit and one or more selected project observations.               |
| `POST /v1/projects/:projectId/workflows/:recordId/transitions` | Apply an auditable, state-model-validated workflow transition. Site-visit reports require `draft → internal_review → issued → acknowledged`; each recorded transition provides the approval/acknowledgement evidence. |
| `GET /v1/projects/:projectId/execution-register`               | Read field and construction-administration registers.                                                                                                                                                                 |

Start the mobile field app with `pnpm --filter @orbita/mobile dev`, then use
Expo Go or an iOS/Android simulator. “Capture observation” and “Start” a site
visit both save device-local SQLite records first, so a capture survives an app
restart. A site visit records its date, location, attendees, weather,
checklist, and notes. The sync indicator makes local, syncing, synced, failed,
and conflict states explicit. The current mobile app uses Keycloak
Authorization Code + PKCE, stores its short-lived access token in the device
secure store, and submits its queue only after an authenticated project session
is available. The API’s `clientCaptureId` deduplicates retries when the app
submits the draft. After an observation has synchronized, **Create task**
creates a project task with that observation retained as its source record; the
native Tasks tab shows only those source-linked field tasks.

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

| Endpoint                                                      | Purpose                                                                                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/projects/:projectId/brain/search?q=...`              | Permission-aware retrieval from filed communications, document revisions, workflow records, observations, and tasks, with source citations.                    |
| `POST /v1/projects/:projectId/brain/drafts`                   | Create an evidence-backed, review-required RFI, site report, meeting-minutes, risk-summary, submittal-review, document-classification, or record-search draft. |
| `POST /v1/projects/:projectId/brain/drafts/:draftId/feedback` | Record a user judgment (`correct`, `incorrect`, `incomplete`, `unsafe`, or `not_useful`) and optional correction for an AI draft.                              |
| `POST /v1/projects/:projectId/brain/drafts/:draftId/approve`  | Record explicit human approval. Approval does not itself issue a contractual project record.                                                                   |
| `POST /v1/projects/:projectId/brain/drafts/:draftId/reject`   | Record explicit human rejection; a reviewed draft cannot be issued by this endpoint.                                                                           |
| `GET /v1/ai/records/export`                                   | Administrator-only export of organization AI settings, drafts, and audit events in `orbita-ai-records/v1` JSON.                                                |
| `DELETE /v1/projects/:projectId/brain/drafts/:draftId`        | Administrator-only deletion of a generated draft; deletion audit evidence is retained.                                                                         |

The current local implementation produces cited review briefs without sending
customer data to an external model provider. It records setting changes,
policy checks, retrievals, draft creation, and approvals in the AI audit table.
Administrators can export generated-draft data and delete an individual draft
when retention policy permits. Deletion never erases the minimal audit evidence
that the deletion occurred.
Adding a model provider requires a separate provider configuration, data-
processing review, prompt/output retention control, and evaluation gate.

In the web workspace, **Ask Orbita AI** opens the governed Project Brain panel.
After sign-in and project selection, it can search only permitted retained
records, show their citations, and create a review-required draft. An explicit
approval or rejection changes only the draft's review status; it cannot issue
correspondence or alter a controlled project record.

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

## Web UI checks

The Playwright suite covers the project tabs at a phone viewport: Overview,
Drawings, Field work, Documents, Tasks, Communications, and Cost & contracts.
It also verifies the mobile drawing-to-document upload route and demo work
queue checkbox. Desktop coverage verifies project/team creation dialogs and
the Pipeline, Staffing, and AI workspace entry controls. Every visible control
must either complete a local action or open its matching product surface.

Authenticated workflow controls—including controlled document uploads, task
status transitions, communications filing, commercial records, invoice
lifecycle, project lifecycle, opportunity conversion, and staffing—are backed
by the local API and require a Keycloak account with the relevant role. The
unauthenticated browser suite deliberately checks that those screens offer a
clear sign-in boundary rather than simulating an authorized side effect.

The top-bar settings control opens a responsive **Notification settings**
sheet. Signed-in users can set a default or event-specific delivery preference
for issued workflows, invoices, and payments. The sheet persists in-app/email
choices, digest preference, and optional quiet-hours values. New in-app events
created during quiet hours are stored but remain hidden until the quiet period
ends (India Standard Time for the India-first launch). Email delivery and
digest dispatch require the production delivery worker and sender identity.

The project-activity control opens the in-app notification feed. It lists only
the signed-in user's currently available, permitted notifications; selecting an
unread item records its acknowledgement. Events deferred by quiet hours remain
absent until their configured availability time.

Task assignments, workflow issuance, invoice issuance, and payment receipts
and observation-discussion comments all use the same event-preference and
quiet-hours policy before an in-app notification is created.

Install the browser engines once, then run the suite:

```bash
pnpm --filter @orbita/web exec playwright install chromium webkit
pnpm test:ui
```

For a focused local check, run one test file and project directly:

```bash
env -u CI apps/web/node_modules/.bin/playwright test \
  -c apps/web/playwright.config.ts apps/web/e2e/mobile-project-tabs.spec.ts \
  --project=mobile-chromium --workers=1
```

To run the governed authenticated workflow checks, explicitly supply a short-lived
access token for the local test account. These checks create local test records:

```bash
ORBITA_E2E_ACCESS_TOKEN='local-access-token' \
  env -u CI apps/web/node_modules/.bin/playwright test \
  -c apps/web/playwright.config.ts apps/web/e2e/authenticated-workflows.spec.ts \
  --project=desktop-chromium --workers=1
```

The test runner starts the web app unless an instance is already serving on
port 3000. Set `PLAYWRIGHT_BASE_URL` to test a different local deployment.

## Testing from a phone on the local network

Next development mode protects its JavaScript assets from unapproved origins.
Without configuration, a phone can receive the initial HTML but its client
bundle is blocked; controls such as project tabs then appear inert. Add the
Mac's LAN address to `.env` before starting the web app:

```bash
ORBITA_WEB_ALLOWED_DEV_ORIGINS=192.168.1.25
```

Replace the example address with the machine's current LAN address (on macOS,
`ipconfig getifaddr en0` commonly prints it). With the phone and Mac on the
same network, open `http://192.168.1.25:3000` on the phone. The web dev server
binds to the local network, but only the configured host is permitted to fetch
its development assets.

For phone sign-in, authenticated project data, and document uploads, set the
reusable phone-reachable host in both the root `.env` and `apps/web/.env`, then
restart both services:

```bash
ORBITA_LAN_HOST=192.168.1.25
```

The API derives its allowed web origin, local Keycloak issuer, and browser
storage URL from this value. `S3_ENDPOINT` remains `http://localhost:9000` for
the API itself; use `S3_PUBLIC_ENDPOINT` only when storage is hosted elsewhere.
The imported local Keycloak `orbita-web` client must include
`http://<LAN-IP>:3000/*` as a redirect URI and `http://<LAN-IP>:3000` as a web
origin. The realm template includes the current example LAN address; update it
if the computer's Wi-Fi IP changes.

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
