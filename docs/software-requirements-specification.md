# Software Requirements Specification

## Architecture-led Project Delivery Platform

**Version:** 0.1 (MVP baseline)  
**Status:** Draft for product and technical review  
**Date:** 4 August 2026

## 1. Purpose

This document specifies the MVP for a multi-tenant SaaS platform that helps architecture and engineering (A&E) firms manage their practice and construction-administration work from proposal through project handover.

The product will combine:

- firm operations: projects, fee budgets, staff allocations, time, invoicing, and profitability;
- project information management: documents, drawings, correspondence, and an auditable record;
- construction administration: site visits, issues, RFIs, submittals, instructions, meetings, and approvals.

The goal is not to replicate all of Procore or Autodesk Forma in the MVP. The goal is to create a daily operating system for architecture-led teams that can exchange data with those platforms when they are used by a contractor or owner.

## 2. Scope

### 2.1 In scope for MVP

1. Organization, user, role, project, and external-collaborator management.
2. Opportunity-to-project conversion and high-level fee/project planning.
3. Project budgets, phase budgets, staff allocations, time entries, project health, invoices, and payment status.
4. Controlled document and drawing records, revisions, metadata, sharing, and 2D viewing.
5. Site visits, observations/issues, photos, field capture, reports, and issue assignment.
6. RFIs, submittals, site instructions, meetings, decisions, and task follow-up.
7. Project-wide search, reporting, notifications, audit trail, and export.
8. A permission-aware AI project brain: multimodal ingestion, grounded search, assistive drafting, risk detection, and supervised workflow agents.
9. Channel-aware communication management: native notifications, Gmail/Google Workspace and Microsoft 365 email capture, plus a defined WhatsApp Business Platform integration path.
10. Initial integrations: Microsoft 365 or Google Workspace, QuickBooks Online or Xero, and import/export support.

### 2.2 Explicitly out of scope for MVP

- Native BIM authoring, clash detection, and advanced 3D model coordination.
- General-contractor procurement, bid leveling, subcontractor payment applications, and comprehensive construction accounting.
- Critical-path scheduling engine and equipment/crew optimization.
- Automated building-code compliance decisions.
- Autonomous AI issuance of contractual documents.
- Full owner capital-planning and facilities-management suite.

### 2.3 Later phases

| Phase | Primary expansion                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2     | Submittal packages, advanced markups, client/contractor portals, Autodesk Docs and Procore connectors, WhatsApp Business messaging, richer change control |
| 3     | Portfolio controls, owner cost/funding views, resource forecasting, proposals/e-signature, full accounting integrations                                   |
| 4     | BIM/model coordination, advanced schedule/cost risk intelligence, asset handover, ecosystem APIs and custom AI agents                                     |

## 3. Product context and users

### 3.1 Primary users

| Persona                                     | Primary outcomes                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Principal / practice owner                  | See portfolio health, capacity, margins, receivables, and delivery risk.                   |
| Project architect / project manager         | Coordinate delivery, control fee burn, issue records, manage decisions, and close actions. |
| Construction administrator / site architect | Capture field evidence, issue observations, manage RFIs/submittals, and publish reports.   |
| Finance / operations lead                   | Control budgets, time, invoicing, payments, and firm utilization.                          |
| Project team member                         | Log time, access current documents, complete tasks, and collaborate.                       |

### 3.2 External users

| Persona        | Primary outcomes                                                              |
| -------------- | ----------------------------------------------------------------------------- |
| Owner / client | Review progress, approvals, reports, selected financial and decision records. |
| Contractor     | Receive/respond to issues, RFIs, instructions, and submittals.                |
| Consultant     | Coordinate drawings, respond to RFIs, and review assigned records.            |
| Vendor         | Participate only in a specifically shared submittal or approval workflow.     |

### 3.3 Product principles

1. A project record is connected, not a set of folders.
2. Contractual and financial actions require traceability and accountable human approval.
3. The mobile field experience is optimized for capture; the web experience is optimized for coordination and control.
4. Permissions apply consistently to records, search results, reporting, integrations, and AI.
5. External parties may collaborate without seeing internal firm financials, private notes, or other projects.

## 4. Roles and authorization

### 4.1 System roles

| Role                       | Organization access                | Project access                 | Financial access                     | External issuance    |
| -------------------------- | ---------------------------------- | ------------------------------ | ------------------------------------ | -------------------- |
| Organization administrator | Full                               | Full                           | Configurable                         | Full                 |
| Principal                  | Portfolio read; configurable admin | Full                           | Full                                 | Full                 |
| Project manager            | Assigned projects                  | Create/edit/issue              | Project budget; no firm compensation | Configurable         |
| Project team member        | Assigned projects                  | Create/edit permitted records  | Own time only by default             | No                   |
| Finance/operations         | Full operational scope             | Read or assigned               | Full                                 | Invoice-related only |
| External collaborator      | None                               | Explicitly shared records only | None by default                      | Respond/review only  |

### 4.2 Authorization requirements

- **FR-AUTH-001:** The system shall enforce organization-level tenant isolation.
- **FR-AUTH-002:** The system shall support role-based access controls with project-level overrides.
- **FR-AUTH-003:** Each record shall have a visibility classification: `internal`, `project-team`, `external-selected`, or `public-link` (disabled by default).
- **FR-AUTH-004:** Users shall only search, export, receive notifications about, or query AI over records they are authorized to view.
- **FR-AUTH-005:** Permission and sharing changes shall be captured in the audit log.

## 5. Functional requirements

### 5.1 Organization, people, and portfolio

- **FR-ORG-001:** Administrators shall create an organization, offices, operating currency, time zone, and default document/numbering standards.
- **FR-ORG-002:** Administrators shall invite internal users and external collaborators, assign roles, revoke access, and retain an access audit trail.
- **FR-ORG-003:** The system shall maintain a single contacts directory with organizations, disciplines, roles, addresses, and project relationships.
- **FR-ORG-004:** The system shall display a portfolio view of project stage, fee health, receivables, workload, open risks, and delivery status.
- **FR-ORG-005:** Portfolio data shall be filterable by office, principal, client, project type, status, and date range.

**Acceptance criteria:** A principal can identify projects at risk due to fee burn, overdue receivables, staffing shortage, or unresolved construction items without opening each project.

### 5.2 Pipeline, project setup, and fee planning

- **FR-PROJ-001:** Users with permission shall create opportunities with client, anticipated fee, probability, target dates, and project type.
- **FR-PROJ-002:** A winning opportunity shall be convertible into a project without re-entering client, proposal, fee, phase, and initial staffing data.
- **FR-PROJ-003:** A project shall support standard stages: pursuit, concept, schematic design, design development, construction documents, tender, construction administration, handover, archived.
- **FR-PROJ-004:** Project managers shall define phases, deliverables, milestones, fee budget, target hours, and accountable owner.
- **FR-PROJ-005:** Project managers shall create staff allocations by person, phase, date range, planned hours, and billable/non-billable classification.
- **FR-PROJ-006:** The system shall retain a versioned baseline when approved fee budgets or milestones change.

### 5.3 Time, capacity, profitability, invoicing, and payments

- **FR-FIN-001:** Users shall enter time against project, phase, task, date, and billable status using web and mobile interfaces.
- **FR-FIN-002:** Managers shall review, return, approve, and lock submitted time entries.
- **FR-FIN-003:** The system shall calculate planned, logged, invoiced, paid, written-off, and remaining fee/hours by project and phase.
- **FR-FIN-004:** The system shall provide project health indicators for fee burn, schedule, staffing allocation, invoicing, and receivables; the formula and thresholds must be configurable and visible.
- **FR-FIN-005:** Authorized users shall create invoices from fee schedules, approved time, fixed-fee milestones, reimbursables, and approved changes.
- **FR-FIN-006:** Invoices shall support draft, internal-review, issued, partially-paid, paid, overdue, void, and written-off states.
- **FR-FIN-007:** The system shall synchronize approved invoices, payment status, clients, and relevant project references with one supported accounting connector. Sync failures shall be visible and retryable.
- **FR-FIN-008:** Internal compensation data shall be available only to explicitly authorized roles and excluded from project guest access.

**Acceptance criteria:** A project manager can see, by phase, whether fee or hours are forecast to overrun before the final invoice; a finance user can trace every issued invoice back to its project and approved source lines.

### 5.4 Document, drawing, and correspondence management

- **FR-DOC-001:** Users shall upload documents individually and in bulk, preserving original files and creating immutable file versions.
- **FR-DOC-002:** Each document shall have a type, discipline, title, revision, status, issue date, issuer, project, and optional building/floor/zone metadata.
- **FR-DOC-003:** A drawing register shall group drawing revisions under a stable drawing number and clearly identify the current issued revision.
- **FR-DOC-004:** Superseded drawings shall remain accessible but shall not be confused with the current revision.
- **FR-DOC-005:** The system shall render PDFs for in-browser 2D viewing and allow comments, pins, and links to related records.
- **FR-DOC-006:** Users shall create transmittals with selected documents, recipients, purpose, issue notes, and a permanent receipt record.
- **FR-DOC-007:** The system shall ingest project email from a configured mailbox or supported mail integration; filing must be user-confirmed in MVP.
- **FR-DOC-008:** Every record may link to documents, drawings, revisions, emails, photos, tasks, decisions, and related records.
- **FR-DOC-009:** Search shall support filename, metadata, document content where extractable, project record number, and natural-language queries.

### 5.5 Communications and notifications

#### 5.5.1 Unified communication record

- **FR-COMM-001:** The system shall store project communications as immutable messages or message threads linked to projects, contacts, and optionally documents, drawings, RFIs, submittals, issues, instructions, decisions, tasks, and meetings.
- **FR-COMM-002:** A communication shall record its channel, direction, sender, recipients, sent/received time, thread identifier, attachments, filing status, source-system identifier, and retention classification.
- **FR-COMM-003:** Users shall be able to file an email or business message to a project manually, and authorized rules may recommend a project/record without automatically filing it in MVP.
- **FR-COMM-004:** Project search and the AI Project Brain shall include only communications that are filed, retained, indexed, and permitted for the requesting user.
- **FR-COMM-005:** Replies issued through a connected channel shall preserve the channel's native thread/conversation identifier where supported.

#### 5.5.2 Gmail and Microsoft 365 email

- **FR-COMM-006:** The system shall support OAuth-based Gmail/Google Workspace connection for an authorized mailbox, with scoped read, draft, and send permissions selected by the organization.
- **FR-COMM-007:** Gmail ingestion shall preserve thread identity, message identifiers, headers, recipients, attachments, timestamps, and the original message source; Gmail supports conversation threads and mailbox change notifications, which shall be used instead of continuous polling where available. [Gmail API overview](https://developers.google.com/workspace/gmail/api/guides)
- **FR-COMM-008:** The system shall support Microsoft 365/Outlook mail connection through Microsoft Graph, including message-change subscriptions where permitted. [Microsoft Graph subscriptions](https://learn.microsoft.com/en-us/graph/api/subscription-get?view=graph-rest-1.0)
- **FR-COMM-009:** Users shall be able to compose a project email, save a draft, and send it through a connected authorized mailbox; the sent message and its delivery/failure result shall be retained in the project record.
- **FR-COMM-010:** The system shall not silently ingest a user’s entire mailbox by default. Mailbox scope, historical import period, project filing rules, and attachment limits shall be explicit organization settings.
- **FR-COMM-011:** Disconnecting a mailbox shall stop future synchronization without deleting already filed project records unless an authorized retention action is taken.

#### 5.5.3 WhatsApp Business Platform

- **FR-COMM-012:** The platform shall support WhatsApp only through an organization-authorized WhatsApp Business Platform account or approved provider integration; it shall not scrape, mirror, or access an employee’s personal WhatsApp account or WhatsApp Web session.
- **FR-COMM-013:** The integration shall receive eligible inbound business messages and status events by verified webhook, validate the webhook signature, deduplicate delivery, and retain the external conversation/message identifiers. WhatsApp Business Platform uses webhooks for message events. [WhatsApp Cloud API documentation](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- **FR-COMM-014:** Authorized users shall send WhatsApp Business messages, approved templates, documents, and project links only when recipient consent, message-template, session-window, and other platform policy requirements are satisfied.
- **FR-COMM-015:** A WhatsApp message may be linked to a project and project record after user review; it shall retain channel, business number, participant(s), external message ID, media metadata, delivery/read status where available, and filing audit trail.
- **FR-COMM-016:** The product shall clearly distinguish WhatsApp Business communication from contractual issuance. A WhatsApp message cannot by itself issue, approve, close, or amend a contractual record; the related RFI, instruction, submittal, or decision workflow remains the system of record.
- **FR-COMM-017:** General-purpose AI chat through WhatsApp is out of scope. WhatsApp may surface approved project notifications or support limited, policy-compliant business workflow messaging, while AI work remains inside the authenticated platform.

#### 5.5.4 Notifications

- **FR-NOTIF-001:** The system shall provide in-app notifications for assignments, mentions, approvals, comments, status changes, integration failures, AI drafts, approaching deadlines, and escalations.
- **FR-NOTIF-002:** Users shall receive web and mobile push notifications only after platform-level permission is granted; notification content shall not expose restricted data on a lock screen by default.
- **FR-NOTIF-003:** Users shall configure channel preferences, quiet hours, and digest frequency by event type, while organization administrators may define mandatory notices for contractual and security events.
- **FR-NOTIF-004:** Email notifications shall use an authenticated organizational sender identity and include deep links to the permitted record.
- **FR-NOTIF-005:** WhatsApp notifications shall be a separately enabled channel, must respect recipient consent and WhatsApp policy, and shall not include confidential attachments or sensitive content by default.
- **FR-NOTIF-006:** Notifications shall be deduplicated, delivered asynchronously, track delivery result where available, and never change the underlying record state.

### 5.6 Site visits and field observations

- **FR-FIELD-001:** Mobile users shall create an offline site-visit draft with date, location, attendees, weather, checklist, and notes.
- **FR-FIELD-002:** Mobile users shall capture photo, video, voice note, text note, drawing pin, location, floor, zone, trade, and issue severity.
- **FR-FIELD-003:** A captured observation shall be convertible into an issue, RFI draft, site instruction draft, task, or report-only observation.
- **FR-FIELD-004:** Issues shall support ID, title, description, category, location, linked evidence, linked drawing/revision, assignee, due date, priority, status, and discussion.
- **FR-FIELD-005:** The system shall generate a reviewable site-visit report from selected observations and permit digitally recorded approval/acknowledgement.
- **FR-FIELD-006:** Mobile users shall see explicit local, syncing, synced, failed, and conflict states for field captures.

### 5.7 Construction administration workflows

- **FR-CA-001:** The system shall manage RFIs with structured question, responsible party, due date, attachments, linked records, threaded discussion, response, and status.
- **FR-CA-002:** The system shall manage submittals with package, specification reference, required reviewers, review markup/comments, response code, and revision cycles.
- **FR-CA-003:** The system shall manage site instructions with responsible party, instruction text, applicable drawing, issue date, acknowledgement, and completion state.
- **FR-CA-004:** The system shall manage meeting agendas, attendance, minutes, decisions, actions, and linked RFIs/issues.
- **FR-CA-005:** The system shall manage a decision register with decision owner, due date, options, approver, final decision, evidence, and impact links.
- **FR-CA-006:** The system shall notify responsible parties before due dates and escalate overdue contractual items according to project rules.
- **FR-CA-007:** The system shall preserve issue/response history and prevent edits to issued records; corrections shall use a new revision, amendment, or superseding record.

#### Required state models

| Record           | States                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Issue            | Draft → Open → In progress → Ready for review → Closed; may be Reopened                            |
| RFI              | Draft → Issued → Answered → Closed; may be Returned or Reopened                                    |
| Submittal        | Draft → Submitted → Under review → Revise/resubmit or Approved/Approved as noted/Rejected → Closed |
| Site instruction | Draft → Issued → Acknowledged → Completed → Verified → Closed                                      |
| Meeting minutes  | Draft → Internal review → Issued → Superseded/Archived                                             |

### 5.8 Tasks and reporting

- **FR-WORK-001:** Tasks shall be creatable directly or from any project record and retain a backlink to the source record.
- **FR-WORK-002:** Users shall have a personal worklist across projects, with due date, status, owner, and priority.
- **FR-WORK-003:** The system shall provide exportable registers for documents, drawings, issues, RFIs, submittals, site visits, decisions, time, invoice status, and project health.
- **FR-WORK-004:** Reports shall respect the viewer's permissions and include generation timestamp and applied filters.

### 5.9 AI-assisted work

#### 5.9.1 Product boundary

AI is a cross-cutting product capability, not a standalone chat feature. It accelerates capture, retrieval, review, risk detection, and workflow preparation. It shall never make a final contractual, financial, safety, design, code-compliance, or payment decision. Every outward-facing action remains subject to the normal role, approval, and issuance workflow.

The MVP provides four AI modes: **Project Brain** (cited Q&A), **capture intelligence** (multimodal data-to-record drafting), **review intelligence** (comparison/extraction/cross-reference), and **supervised agents** (multi-step preparation for human approval).

#### 5.9.2 Knowledge ingestion and grounded retrieval

- **FR-AI-001:** Organization administrators shall configure whether AI is enabled, permitted projects/sources, retention, and roles allowed to use each AI capability.
- **FR-AI-002:** The platform shall asynchronously index permitted project records while preserving source, record version, project relationship, and visibility classification.
- **FR-AI-003:** MVP ingestion shall support record metadata, documents, emails, PDFs, OCR scans, drawing sheets, photos, voice transcripts, meeting transcripts, and structured project data.
- **FR-AI-004:** Index status, source version, failure reason, retry action, and date indexed shall be visible to authorized users.
- **FR-AI-005:** Deleted, superseded, withheld, and permission-revoked content shall be excluded from new results within a documented reindexing SLA.
- **FR-AI-006:** Authorized users shall ask natural-language questions scoped to a project, selected records, portfolio, or their permitted worklist.
- **FR-AI-007:** Every answer shall include citations with the record/document, revision where applicable, supporting excerpt/location, and a link to the source.
- **FR-AI-008:** If evidence is insufficient, contradictory, unavailable, or restricted, the system shall disclose that limitation rather than give an ungrounded answer.
- **FR-AI-009:** AI access shall be evaluated using the requester’s permissions at query time, not only when content was indexed.

#### 5.9.3 Capture and drafting intelligence

- **FR-AI-010:** From a site visit, the system shall draft observation titles, descriptions, categories, locations, assignees, due dates, and report sections from selected photos, voice notes, video, and typed notes.
- **FR-AI-011:** From a meeting transcript or notes, the system shall draft minutes, attendance, decisions, actions, risks, and potential RFIs with links to supporting evidence.
- **FR-AI-012:** From selected evidence, the system shall draft RFIs, site instructions, responses, submittal-review comments, transmittal notes, and change-event summaries.
- **FR-AI-013:** The system shall propose document metadata—type, discipline, drawing number, title, revision, issue date, and status—and require user confirmation before committing it.
- **FR-AI-014:** AI-generated structured fields shall show confidence and supporting evidence, remain editable, and never bypass human review.
- **FR-AI-015:** Generated records shall remain marked `AI draft` until a human explicitly saves, submits, or issues them through the applicable workflow.

#### 5.9.4 Review, risk, and supervised agents

- **FR-AI-016:** Users shall compare two drawings or documents and receive a reviewable list of detected changes, labelled as visual, textual, metadata, or inferred.
- **FR-AI-017:** The system shall recommend potentially related records, such as an open RFI affected by a drawing revision or an issue related to a submittal.
- **FR-AI-018:** The system shall highlight potential risk signals from permitted data, including overdue responses, recurring issue categories, fee-burn variance, unbilled time, missing approvals, and incomplete closeout records.
- **FR-AI-019:** Each risk signal shall show contributing records and rule/model rationale; it is decision support, not a contractual conclusion.
- **FR-AI-020:** Users shall be able to mark AI output correct, incorrect, incomplete, unsafe, or not useful, with an optional correction.
- **FR-AI-021:** MVP agents shall prepare site reports, meeting minutes, RFIs, submittal reviews, document classifications, and project-record searches.
- **FR-AI-022:** An agent shall show its objective, sources, planned actions, draft outputs, and missing information before a user accepts its results.
- **FR-AI-023:** Agents may create drafts and recommend tasks or links, but shall not issue correspondence, approve a submittal, close a contractual record, alter financial data, or change permissions in MVP.
- **FR-AI-024:** Accepted agent actions shall be attributable to the approving user and pass the same authorization and validation rules as manual actions.

#### 5.9.5 Governance and audit

- **FR-AI-025:** The system shall never expose inaccessible data in answers, embeddings, summaries, agent plans, notifications, or exports.
- **FR-AI-026:** Customer content shall not train shared foundation models without explicit, revocable customer consent.
- **FR-AI-027:** The system shall record request metadata, source references, model/version, output, reviewer feedback, agent actions, and resulting record actions in the audit log.
- **FR-AI-028:** Organizations shall be able to export and delete AI interaction records according to retention policy, subject to legally required audit retention.
- **FR-AI-029:** AI interfaces shall identify generated content, display its evidence basis, and provide an easy path to open, edit, reject, or report it.

### 5.10 Integration and data portability

- **FR-INT-001:** The system shall support OAuth-based connections to at least one accounting system and one productivity suite in MVP.
- **FR-INT-002:** The system shall provide CSV import for contacts, projects, budgets, time entries, drawing registers, and issue/RFI registers.
- **FR-INT-003:** The system shall export project records, attachments, and audit data in a documented, non-proprietary package.
- **FR-INT-004:** The platform shall expose versioned APIs and outbound webhooks for core project records no later than Phase 2.
- **FR-INT-005:** Integration actions shall be idempotent where possible and expose sync status, errors, and retries to authorized users.

## 6. Core domain model

| Entity                                | Key relationships                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Organization                          | Owns offices, users, contacts, templates, projects, integrations                           |
| Project                               | Belongs to organization; has phases, budgets, team, records, documents, financials         |
| Project phase                         | Has fee/hour budget, milestones, allocations, time entries, invoices                       |
| Person / contact                      | May be an internal user or external party; has project roles                               |
| Document                              | Has versions and metadata; links to any project record                                     |
| Drawing / revision                    | Stable drawing number with immutable revision records; links to locations and work records |
| Site visit                            | Owns field captures and published reports                                                  |
| Issue / RFI / submittal / instruction | Workflow record linked to people, documents, locations, tasks, and audit events            |
| Decision / meeting / task             | Links work, accountability, and evidence across project records                            |
| Invoice / payment                     | Links firm financial work to project and phase financials                                  |
| Audit event                           | Append-only actor, timestamp, action, target, before/after summary, and correlation ID     |

## 7. Non-functional requirements

### 7.1 Security and privacy

- **NFR-SEC-001:** All customer data shall be encrypted in transit using TLS 1.2+ and at rest using managed industry-standard encryption.
- **NFR-SEC-002:** The MVP shall support MFA. SAML SSO and SCIM shall be on the enterprise roadmap before enterprise release.
- **NFR-SEC-003:** The system shall implement logical tenant isolation, least-privilege service access, secrets management, and regular access review.
- **NFR-SEC-004:** Files shall be virus scanned before availability; downloads shall use short-lived authorized URLs.
- **NFR-SEC-005:** Security-relevant events shall be tamper-evident and retained according to organization policy.
- **NFR-SEC-006:** The security program shall target SOC 2 Type II readiness; privacy operations shall support GDPR-style data subject and DPA requirements.

### 7.2 Availability, recovery, and data integrity

- **NFR-REL-001:** The service shall target 99.9% monthly availability for the MVP, excluding announced maintenance.
- **NFR-REL-002:** Production data shall be backed up automatically and restore procedures tested at least quarterly.
- **NFR-REL-003:** MVP recovery targets: RPO ≤ 24 hours and RTO ≤ 8 hours. Enterprise targets shall improve before contractual enterprise SLAs.
- **NFR-REL-004:** Issued records, approvals, revisions, financial actions, and audit events shall be immutable; amendments must preserve the original.

### 7.3 Performance and scale

- **NFR-PERF-001:** Normal web navigation and common list views shall return usable content within 2 seconds at the 95th percentile under expected load.
- **NFR-PERF-002:** Metadata and text search shall return initial results within 2 seconds at the 95th percentile; asynchronous indexing status shall be visible.
- **NFR-PERF-003:** Large-file rendering, OCR, drawing comparison, report generation, and AI processing shall run as asynchronous jobs with visible progress and retry semantics.
- **NFR-PERF-004:** The architecture shall support horizontal scaling of API, search/indexing, file-processing, notification, and AI job workloads.

### 7.4 Mobile and offline behavior

- **NFR-MOB-001:** The mobile application shall allow site-visit drafts, evidence capture, and issue drafts without connectivity.
- **NFR-MOB-002:** Offline data shall be encrypted on device and removed on logout or remote-access revocation when connectivity resumes.
- **NFR-MOB-003:** Synchronization shall be resumable, idempotent, and transparent; conflicting edits shall create a reviewable conflict rather than silently overwrite data.

### 7.5 AI quality, safety, and operations

- **NFR-AI-001:** AI responses that make factual claims about project data shall be grounded in retrieved, permission-checked source material and include citations.
- **NFR-AI-002:** The AI service shall maintain tenant and project isolation for retrieval indexes, embeddings, prompts, tool calls, logs, and caches.
- **NFR-AI-003:** The platform shall evaluate representative workflows before release using accuracy, citation coverage, permission-leakage, harmful-output, latency, and human-acceptance measures; releases shall meet documented thresholds.
- **NFR-AI-004:** High-impact use cases—financial variance, contract review, schedule risk, safety, code, and compliance—shall be labelled advisory and require a human confirmation step.
- **NFR-AI-005:** The system shall provide a kill switch to disable organization or platform-level AI generation while preserving the source system of record.
- **NFR-AI-006:** AI tasks shall expose processing state, support cancellation where safe, and fail safely without corrupting source records or blocking manual workflow.
- **NFR-AI-007:** The platform shall retain model/prompt/template versioning sufficient to reproduce and investigate material AI outputs.

### 7.6 Accessibility, internationalization, and usability

- **NFR-UX-001:** Web and mobile user interfaces shall meet WCAG 2.2 AA for supported experiences.
- **NFR-UX-002:** The system shall support keyboard navigation, screen readers, contrast-compliant status indicators, and non-color status labels.
- **NFR-UX-003:** Users shall be able to select light, dark, or system theme. Organization administrators may set an organization default but shall not override an individual's accessible preference.
- **NFR-UX-004:** Product color, typography, spacing, elevation, motion, and component states shall use versioned semantic design tokens rather than hard-coded values in application components.
- **NFR-UX-005:** All supported themes shall meet the same contrast, focus, status, and error-state accessibility requirements.
- **NFR-I18N-001:** The data model shall support time zones, currencies, metric/imperial units, localized dates, and multilingual content without redesign.

### 7.7 Observability and operational quality

- **NFR-OPS-001:** The platform shall emit structured logs, metrics, traces, job status, and integration failure events with correlation IDs.
- **NFR-OPS-002:** Releases shall support automated tests, staged rollout, feature flags, monitoring, and rollback.
- **NFR-OPS-003:** A customer-facing service-status view and internal incident response procedure shall be available before paid general availability.

## 8. Key user journeys and acceptance outcomes

### 8.1 Field observation to accountable resolution

1. A site architect captures a photo and voice note offline.
2. The system creates a synced draft observation with visit, location, and evidence links.
3. The architect reviews it, links a current drawing revision, assigns the contractor, and issues an observation or site instruction.
4. The contractor acknowledges and responds.
5. The architect verifies closure; the issued history remains available in the final report and project record.

**Outcome:** The user can complete this flow in under two minutes after capture when connected; no assignment, evidence, or status change is lost.

### 8.2 Fee risk to corrective action

1. A project manager sees a phase forecast exceeding the approved fee budget.
2. They identify contributing time, allocation, deliverables, and unbilled work.
3. They adjust future staffing or create a scope/change conversation record.
4. The decision and affected financial baseline are preserved.

**Outcome:** Forecast variance is visible before invoice issuance and linked to the people and project work causing it.

### 8.3 Searchable, defensible project record

1. A user searches for the latest HVAC drawing for Level 02 or the decision behind a field instruction.
2. The system returns only permitted records with revision/status context.
3. The user can open the drawing, related RFI, email, issue, and issued instruction.

**Outcome:** Project evidence is found without navigating uncontrolled folders or disparate communication tools.

## 9. MVP success measures

- At least 70% of pilot site-visit reports are generated from platform-captured records.
- Median field observation capture-to-issue time is under two minutes.
- At least 80% of active pilot projects maintain their drawing register and issue register in the product weekly.
- Project managers identify fee-budget variance before end-of-phase billing on pilot projects.
- At least 90% of AI draft actions are reviewed before issuance; zero AI-originated external actions occur without an authorized human workflow action.
- At least 85% of evaluated Project Brain answers provide usable citations; every cited source is permission-checked at retrieval time.
- Pilot users accept, after review and editing, at least 50% of AI-generated site-report or meeting-minute drafts.
- Confirmed AI permission leakage is zero in pre-release evaluation and production monitoring.
- Pilot firms can export their complete project record without vendor assistance.

## 10. Open decisions

1. Initial launch geography and data-residency requirements.
2. First accounting connector: QuickBooks Online or Xero.
3. Whether invoices/payments are MVP features or launched immediately after time/budget reporting.
4. Initial mobile architecture and supported offline file sizes.
5. Initial email-ingestion path: Microsoft 365, Google Workspace, or both.
6. Contractual terminology and templates required for the target geography.
7. Whether the first commercial segment is 5–50 person firms or 50–200 person multidisciplinary practices.

## 11. Traceability to competitive intent

| Competitive learning                                                                                    | MVP response                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Monograph proves A&E firms pay for connected fee, time, staffing, billing, and profitability workflows. | Include firm operations as a first-class product domain.                                        |
| Newforma proves the value of a linked, auditable project-information record for design teams.           | Make documents, correspondence, drawings, and construction records connected and searchable.    |
| Procore proves cost, field, workflow, and network data create high-value operational control.           | Build rigorous issue/RFI/approval data and selected cost visibility; defer GC accounting depth. |
| Autodesk proves design/model connectivity and integrations are strategic infrastructure.                | Treat BIM and ecosystem connectors as product foundations; do not attempt BIM authoring in MVP. |
