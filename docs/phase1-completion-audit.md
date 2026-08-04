# Phase 1 completion audit

**Status:** Active delivery audit — not a release approval  
**Last reviewed:** 4 August 2026

This document records evidence for the India-first Phase 1 scope. A checkmark
means the repository has an implemented, automated-smoke-tested local path; it
does not claim that a third-party credential, pilot validation, or production
operation has occurred.

## Verified local delivery

| Area                                                   | Evidence                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity, organization, roles, external project access | Keycloak guard, project membership enforcement, add/revoke collaborator APIs, and audit events.                                                                                                                                                                                        |
| Users, teams, capacity                                 | People directory, team roster/assignment APIs, capacity calculation, and authenticated project roster.                                                                                                                                                                                 |
| Pipeline and proposals                                 | Opportunities, versioned proposals, fee phases, initial staffing, and transactional proposal-to-project conversion.                                                                                                                                                                    |
| Lifecycle and planning                                 | Standard delivery stages, auditable stage/status transitions, fee phases, staff allocations, and governed task transitions.                                                                                                                                                            |
| Documents and drawings                                 | Direct S3/MinIO upload, batch preparation, SHA-256 integrity verification, revision supersession, site-context metadata, signed download, 2D viewer, and access-checked, auditable comments/pins.                                                                                      |
| Field and execution                                    | Durable mobile observation capture/sync, structured offline observations, local photo capture, discussion sync, site visits, selected-observation report drafts, review → issue → acknowledgment controls, RFIs, submittals, instructions, meetings, decisions, and state transitions. |
| Commercial and owner cost                              | Fee/time ledger, GST invoices, payments, owner budgets, commitments, change events, forecast, and CSV exports.                                                                                                                                                                         |
| Communications and notifications                       | Manual project filing, native notification feed, preferences, quiet-hour deferral, Gmail OAuth/file/send boundary, and explicit WhatsApp Business Phase 2 boundary.                                                                                                                    |
| AI governance                                          | Organization opt-in, permission-aware cited retrieval, review-required drafts, approval/rejection, feedback, workspace panel, administrator export/deletion controls, and AI audit events.                                                                                             |
| Portability and audit                                  | Project/commercial CSV exports, portable `orbita-project-record/v1` JSON manifest, project/organization audit feeds.                                                                                                                                                                   |

`scripts/phase1-smoke.mjs` creates a tenant-scoped project through the pipeline
conversion route and exercises every area above, including authentication,
collaborator revocation, document uploads/downloads, execution, commercial
controls, AI review, exports, and retention.

The enabled web workspace also has mobile-viewport coverage for the three
approved project tabs, notification settings/feed, and the governed Project
Brain panel. The mobile field app has local-first visits, structured
observations, comments, personal assigned-task worklist, and permission-gated
photo capture. Device photo URIs remain on-device until the controlled binary
upload/file-processing milestone is configured.

## Repeated local quality gate

The following verification completed successfully on 4 August 2026 against the
local Docker services and Keycloak realm:

```bash
prettier --check .
eslint apps/api/src apps/web/app
tsc -p apps/api/tsconfig.json --noEmit
tsc -p apps/web/tsconfig.json --noEmit
tsc -p apps/mobile/tsconfig.json --noEmit
tsc -p packages/contracts/tsconfig.json --noEmit
tsc -p packages/design-tokens/tsconfig.json --noEmit
node --test tests/*.test.mjs
node scripts/phase1-smoke.mjs
```

The gate proves local source quality and the covered end-to-end workflow. It
does not replace the configuration-gated or production-release evidence below.

## Configuration-gated verification

These features are implemented and safely configuration-gated, but need real
pilot credentials before they can be marked operationally verified:

| Integration              | Required evidence before release                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Gmail / Google Workspace | OAuth consent, token refresh, inbox listing, selected-message filing, outbound send-and-file, and disconnect against a pilot mailbox. |
| Zoho Books               | OAuth consent, customer mapping, invoice creation, idempotent retry behavior, and reconciliation against a pilot organization.        |
| Keycloak MFA             | Pilot realm MFA policy enabled and tested on web and mobile.                                                                          |

## Still required before production release

- Pilot validation with 3–5 Dehradun firms across contractor, architect, and
  owner workflows.
- AWS Mumbai deployment, encrypted backups, recovery exercise, monitoring,
  alerting, and incident runbooks.
- Malware scanning and extraction/OCR worker for uploaded files before any
  external document-processing or model-provider activation.
- Privacy review, retention/deletion operations, Indian contractual templates,
  mobile device test matrix, and app-store compliance materials.

These are release-readiness requirements, not reasons to weaken the local
Phase 1 data, security, or audit controls already implemented.
