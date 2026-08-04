# Phase 1 completion audit

**Status:** Active delivery audit — not a release approval  
**Last reviewed:** 4 August 2026

This document records evidence for the India-first Phase 1 scope. A checkmark
means the repository has an implemented, automated-smoke-tested local path; it
does not claim that a third-party credential, pilot validation, or production
operation has occurred.

## Verified local delivery

| Area                                                   | Evidence                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity, organization, roles, external project access | Keycloak guard, project membership enforcement, add/revoke collaborator APIs, and audit events.                                                 |
| Users, teams, capacity                                 | People directory, team roster/assignment APIs, capacity calculation, and authenticated project roster.                                          |
| Pipeline and proposals                                 | Opportunities, versioned proposals, fee phases, initial staffing, and transactional proposal-to-project conversion.                             |
| Lifecycle and planning                                 | Standard delivery stages, auditable stage/status transitions, fee phases, staff allocations, and governed task transitions.                     |
| Documents and drawings                                 | Direct S3/MinIO upload, batch preparation, verification, revision supersession, site-context metadata, signed download, and 2D viewer.          |
| Field and execution                                    | Durable mobile observation capture/sync, site visits, observations, RFIs, submittals, instructions, meetings, decisions, and state transitions. |
| Commercial and owner cost                              | Fee/time ledger, GST invoices, payments, owner budgets, commitments, change events, forecast, and CSV exports.                                  |
| Communications and notifications                       | Manual project filing, native notifications, Gmail OAuth/file/send boundary, and explicit WhatsApp Business Phase 2 boundary.                   |
| AI governance                                          | Organization opt-in, permission-aware cited retrieval, review-required drafts, approval/rejection, and AI audit events.                         |
| Portability and audit                                  | Project/commercial CSV exports, portable `orbita-project-record/v1` JSON manifest, project/organization audit feeds.                            |

`scripts/phase1-smoke.mjs` creates a tenant-scoped project through the pipeline
conversion route and exercises every area above, including authentication,
collaborator revocation, document uploads/downloads, execution, commercial
controls, AI review, exports, and retention.

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
