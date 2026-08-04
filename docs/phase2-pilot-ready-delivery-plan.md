# Phase 2 — Pilot-ready connected delivery plan

**Status:** Draft for product, design, and technical review  
**Date:** 4 August 2026  
**Companion documents:** [SRS](software-requirements-specification.md), [Information architecture](information-architecture.md), [Phase 1 completion audit](phase1-completion-audit.md), [Implementation readiness](implementation-readiness.md)

## 1. Objective

Phase 2 turns the India-first local Phase 1 foundation into a safe, testable
pilot product for Dehradun contractors, construction firms, architects, and
owners. It must make the daily project-delivery loop usable across internal and
external teams while creating the operational controls required before a cloud
release.

The primary outcome is not a broader dashboard. It is a connected, auditable
workflow:

```text
Organization → project team → document / drawing → review or site record
→ accountable action → communication / issuance → approval → closeout evidence
```

## 2. Product strategy and competitive model

Phase 2 uses the competitors for their strongest operating ideas without
copying their scope.

| Market learning | Phase 2 response |
| --- | --- |
| Monograph connects staffing, fee, billing, and profitability for A&E firms. | Make team assignment, project planning, time, phase health, and receivables work as one firm-to-project flow. |
| Newforma makes the project record and correspondence traceable. | Make every issued/reviewed delivery record linkable, searchable, permissioned, and auditable. |
| Procore makes field control, external participation, and approvals operationally simple. | Add focused RFI, submittal, issue, review, and external-party workflows rather than a general-contractor ERP. |
| Autodesk Construction Cloud treats controlled files and ecosystem interoperability as infrastructure. | Improve controlled sharing, markup/review, imports/exports, and connector boundaries; defer BIM authoring and model coordination. |

### Product decisions

- The organization is the tenant boundary; a project is the delivery boundary.
- An **organization team** is reusable for staffing. A **project team** is an
  explicit project roster with roles and record permissions. An organization
  team may be added to a project, but changes to it do not silently alter a
  project roster.
- Practice financials and owner construction costs remain separate views.
- Field capture stays mobile-first; formal review, administration, cost, and
  document control stay web-first.
- AI only prepares, finds, summarizes, or recommends. It never issues,
  approves, changes financials, or grants access without a human action.

## 3. Phase boundary

### In scope

1. Multi-organization membership, organization switching, and user/profile
   administration.
2. A first-class Projects and Teams experience, including project roster,
   staffing allocations, and role-aware controls.
3. Focused construction-administration workflows: RFIs, submittals, formal
   review, distribution, and decision/meeting follow-up.
4. Controlled external collaboration and client/contractor views.
5. Gmail pilot connection, filing, sending, and audit; Zoho Books pilot
   reconciliation; clear WhatsApp Business preparation only.
6. Production-ready operational controls: backups, observability, security,
   file scanning/extraction, retention operations, release pipelines, and
   device verification.
7. Pilot validation with 3–5 firms and a measured release decision.

### Explicitly deferred

- Native BIM authoring, clash detection, or 3D coordination.
- Payroll, procurement, subcontractor payment applications, or a general
  contractor ERP.
- Personal WhatsApp access or WhatsApp Web automation.
- Autonomous AI actions or contractual approval.
- A marketplace/API platform, advanced portfolio capital planning, and
  enterprise SAML/SCIM beyond an implementation design and security review.

## 4. Release plan

| Increment | Outcome | Exit evidence |
| --- | --- | --- |
| 2A — Workspace control | Correct organization context, people, project roster, permissions, and project navigation. | Multi-org integration tests, access audit events, usability validation with two pilot users. |
| 2B — Controlled delivery | End-to-end RFI, submittal, review, issue, and transmittal workflows across internal and invited external users. | Contractual workflow tests, permission matrix tests, pilot scenario walkthrough. |
| 2C — Connected operations | Gmail and Zoho pilot workflows, production operations, security and file-processing controls. | Credentialed pilot evidence, recovery exercise, monitored staging release. |
| 2D — Pilot release | Dehradun design-partner rollout, feedback closure, and go/no-go decision. | 3–5 firm validation, KPIs, incident/runbook rehearsal, release sign-off. |

## 5. Prioritized requirements and acceptance criteria

### 5.1 2A — Workspace control

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| P2-ORG-001 | Maintain user-to-organization memberships with organization-specific platform roles. | Must | An administrator can invite, activate, suspend, and remove a member without affecting their membership in another organization. Every change is audited. |
| P2-ORG-002 | Provide an organization switcher. | Must | On first sign-in, a user with multiple memberships selects an organization. On later sign-ins, the last active authorized organization opens; the header switcher changes context only after a server authorization check. |
| P2-ORG-003 | Show names, titles, and avatars—not internal identity identifiers—in user-facing surfaces. | Must | Project rosters, assignments, notifications, and record activity show a directory name. Stable IDs remain internal/auditable. |
| P2-ORG-004 | Provide Users, roles, teams, offices, and project access administration. | Must | An organization administrator can inspect effective access, set a role, assign an organization team, and add/remove a project member. A project manager cannot grant privileges above their own authorization. |
| P2-PROJ-001 | Deliver a Projects index with list and filtered views. | Must | Users can find permitted projects by status, lifecycle stage, manager, team, client, and health. Opening a project preserves the selected organization context. |
| P2-PROJ-002 | Deliver a dedicated Project team & staffing page. | Must | A manager can add an individual or reusable organization team, set project role and responsibility, plan allocations by phase/date, see capacity conflicts, and remove project access. |
| P2-PROJ-003 | Protect project membership from organization-team drift. | Should | Adding a team copies its current named members to the project roster. Later team changes display a suggested sync; no access changes occur without confirmation. |
| P2-UX-001 | Make global navigation feel like a workspace, not a dashboard. | Must | Header: organization switcher, project switcher, search, create, AI, notifications, profile. Left navigation: Home, Firm, Projects, Administration. Mobile exposes equivalent destinations through an intentional compact navigation. |

### 5.2 2B — Controlled delivery

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| P2-DOC-001 | Add review packages and markup-ready drawing/PDF review. | Must | A reviewer can be assigned one or more revisions, leave threaded comments/pins, request changes, approve/reject with a required outcome, and see immutable review history. |
| P2-DOC-002 | Add issue/distribution controls. | Must | A document controller can select approved revisions, create a transmittal, choose recipients and purpose, send or export it, and retain a receipt/status record. Superseded revisions cannot be issued as current. |
| P2-EXEC-001 | Complete RFI lifecycle. | Must | An authorized user creates an RFI with question, drawing/document evidence, responsible party, due date, and visibility. Responses, clarification, answer, close/reopen, reminders, and audit history are retained. |
| P2-EXEC-002 | Complete submittal lifecycle. | Must | A contractor/vendor can submit a package; the internal team assigns/reviews it, records an outcome, creates a linked task or RFI when needed, and distributes the decision through an auditable channel. |
| P2-EXEC-003 | Link record types consistently. | Must | From an issue, task, RFI, submittal, decision, or drawing, a user can traverse permitted related records and evidence without duplicate data entry. |
| P2-FIELD-001 | Close the field-to-formal-record loop. | Must | A site observation can become an issue, RFI draft, instruction draft, task, or report item; the source photo/drawing pin/location remains linked. Offline conflict and failed-sync states are actionable. |
| P2-EXT-001 | Add controlled external collaboration. | Must | An invited owner, contractor, consultant, or vendor sees only assigned/shared records and may only take explicitly granted actions. Internal notes, practice finances, other projects, and AI context are never exposed. |

### 5.3 2C — Connected operations and release quality

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| P2-INT-001 | Validate Gmail with a pilot organization. | Must | OAuth consent, token refresh, selected-message filing, attachment handling, reply/send-and-file, thread preservation, disconnect, retry, and audit are tested against a real pilot mailbox. No whole-mailbox import occurs by default. |
| P2-INT-002 | Validate Zoho Books reconciliation. | Must | An approved invoice/customer/project reference syncs idempotently, displays retryable failures, and reconciles payment status without overwriting the system audit trail. |
| P2-FILE-001 | Add secure file-processing pipeline. | Must | Uploads pass malware scanning before external processing; extraction/OCR is queued, observable, bounded by type/size, permission-aware, and produces a recoverable failure state. |
| P2-AI-001 | Expand cited AI only where source quality is proven. | Should | AI can draft a site report, meeting minutes, RFI, or submittal review from permitted evidence, with citations, confidence/unknown state, review-required status, and feedback capture. |
| P2-OPS-001 | Establish cloud release controls. | Must | AWS Mumbai staging and production environments use encrypted secrets, least-privilege access, backups, monitoring, alerting, audit-log retention, deployment rollback, and documented RPO/RTO tests. |
| P2-OPS-002 | Establish mobile release confidence. | Must | A physical Android and iOS device matrix verifies sign-in, organization/project switching, field offline capture, upload/retry, push permission, and deep links over LAN and internet conditions. |

## 6. Roles and permission model for Phase 2

Platform roles are organization-scoped; project roles are assignment-scoped.
The effective permission is the least-privilege combination of both plus the
record visibility classification.

| Platform role | Typical project role | Key Phase 2 permissions |
| --- | --- | --- |
| Organization administrator | Sponsor / administrator | Manage members, roles, teams, integrations, retention, templates, and all project access. |
| Principal | Executive sponsor | Portfolio, financial and delivery health, approval/escalation as configured. |
| Project manager | Project manager | Project roster, planning, delivery records, issue/review workflow, and permitted project finances. |
| Project member | Designer / coordinator | Assigned work, drafts, comments, controlled record creation as granted. |
| Finance/operations | Finance manager | Firm and project accounting, invoicing, payment reconciliation; no construction issuance by default. |
| External collaborator | Owner / contractor / consultant / vendor | Explicitly shared records, responses and review actions only. |

## 7. UX and design deliverables

1. **Screen inventory:** organization picker, workspace home, projects index,
   project team & staffing, directory/user detail, access audit, RFI register
   and record, submittal register and record, review package, external portal,
   integration settings, and release-health administration.
2. **Critical flow wireframes:** first sign-in and org switching; invite to
   external review; create-to-close RFI; submit-to-distribute submittal; field
   observation to issue/report; invoice reconciliation; Gmail file/reply.
3. **Component library additions:** organization/project switchers, identity
   chips, role badge, visibility indicator, assignment picker, status timeline,
   evidence drawer, decision controls, audit panel, empty/error/sync states.
4. **Responsive rules:** one interaction model and shared behavior across web
   and mobile; mobile uses drawers/full-screen records instead of hidden or
   divergent logic. Every enabled control is exercised on a physical device.
5. **Accessibility:** keyboard operation, visible focus, semantic labels,
   adequate contrast, screen-reader names for record status and activity, and
   accessible non-color status indicators.

## 8. Non-functional release requirements

| Area | Phase 2 release requirement |
| --- | --- |
| Tenant isolation | Every organization/project query, file object, search result, notification, export, integration, and AI retrieval is authorization-tested. |
| Identity | Keycloak MFA enabled for pilot admins; OAuth redirect and LAN/mobile host configuration documented; session expiry and sign-out are deterministic. |
| Audit | Membership, role, sharing, issuance, financial, AI, integration, export, and retention actions have immutable actor/time/context audit events. |
| Reliability | Staging restores a backup and demonstrates MVP target RPO ≤ 24 hours and RTO ≤ 8 hours. Background jobs are idempotent, observable, and retry-safe. |
| Performance | Establish pilot budgets: primary workspace interaction p95 ≤ 2.5s on a representative Indian broadband/4G profile; responsive record navigation p95 ≤ 1.5s after data is loaded. |
| Privacy | India-appropriate privacy notice, consent and retention settings, export/delete request process, and documented data-processing inventory before pilot data is onboarded. |
| Security | Dependency scanning, secret scanning, SAST, least-privilege service identities, encrypted transport/storage, signed upload URLs, malware scan gate, and security incident runbook. |
| Quality | Unit/integration/API contract/UI coverage for all permission boundaries and critical flows; browser matrix includes Android Chrome and iOS Safari/WebKit; no mobile-only code path without equivalent automated coverage. |
| Observability | Structured logs with request/correlation IDs, traces for upload/integration/AI jobs, metrics, dashboards, alert thresholds, and a pilot support playbook. |

## 9. Pilot validation plan

Recruit 3–5 Dehradun firms, covering at least one contractor/construction firm,
one architecture practice, and one owner-side representative. Do not use live
contractual issuance until the firm has completed onboarding and approves the
workflow template.

| Scenario | Success signal |
| --- | --- |
| Project setup and team access | A manager creates a project, brings in a reusable team, assigns roles, and an invited party sees only shared records. |
| Drawing/review cycle | A controlled drawing is issued, reviewed with evidence, revised, and the current revision is unambiguous. |
| Field issue loop | A mobile observation is captured offline, synchronized, assigned, discussed, and closed with evidence. |
| RFI/submittal cycle | A question or package reaches its accountable party, receives a recorded disposition, and creates follow-up work. |
| Commercial control | A manager sees fee/time/project health; finance issues/reconciles a controlled invoice with a pilot accounting connection. |
| Communication | A selected Gmail message is filed, a response is sent/filed, and the conversation remains linked and searchable. |

Pilot KPIs: 80%+ successful completion of the agreed scenarios without
facilitator intervention; 90%+ field capture sync success in the test matrix;
zero confirmed tenant/record-visibility violations; and at least three firms
that would continue using the product for a live non-critical project.

## 10. Sequencing and decision gates

1. Confirm pilot firms, scenarios, contractual templates, and data-handling
   consent before onboarding real data.
2. Build and test multi-org/membership and the dedicated projects/teams
   experience first; all later modules depend on correct tenant context.
3. Complete controlled delivery workflows before broadening integrations.
4. Run file-processing, Gmail, Zoho, and cloud operational proofs in staging
   before enabling pilot credentials.
5. Review pilot outcomes, support load, security findings, and commercial
   intent before deciding Phase 3 (portfolio forecasting, e-signatures,
   QuickBooks/Xero, richer portals, or connectors).

## 11. Phase 3 candidates (not Phase 2 commitments)

- Proposal approval and e-signature, advanced pipeline forecast, and resource
  scenario planning.
- QuickBooks/Xero connector after the India-first Zoho Books evidence.
- Autodesk Docs and Procore connector discovery/pilot.
- WhatsApp Business messaging after consent, template, webhook, and retention
  controls are approved.
- Advanced cost/change, owner reporting, and client/contractor portals.
- BIM/model coordination, closeout assets, and specialized supervised AI
  agents.
