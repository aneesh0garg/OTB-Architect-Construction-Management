# Implementation Readiness

## Engineering standards

- Use TypeScript with strict compiler settings for web, mobile, backend, and shared contracts.
- Organize by bounded domain modules (identity, projects, records, finance, communications, AI), not by database table alone.
- Define API contracts and domain events before UI implementation; version public APIs from the start.
- Use a shared design-token and component library. Components consume semantic tokens only.
- Enforce formatting, linting, type checks, unit tests, integration tests, and dependency/security scanning in CI.
- Require code review, small reviewable changes, migrations with rollback/forward strategy, feature flags, and documented release notes.
- Never place credentials in source control; use managed secrets, least-privilege identities, and environment separation.
- Treat audit events, authorization checks, validation, error handling, observability, accessibility, and tests as definition-of-done requirements.

## Selected technology direction

The implementation will use a TypeScript monorepo. This provides shared domain contracts, validation, design tokens, and API clients while producing a full web application and native iOS/Android applications.

| Layer | Decision | Rationale |
|---|---|---|
| Repository | pnpm workspaces + Turborepo | Shared packages with fast, cached local and CI builds. |
| Web workspace | Next.js App Router + React + TypeScript | Strong application routing, server rendering where useful, and typed component development. |
| Native mobile | React Native + Expo + Expo Router + TypeScript | One native codebase for iOS and Android; supports offline field workflows and store-ready binaries. EAS Build/Submit supports Google Play and Apple App Store distribution. |
| UI system | Shared semantic design tokens, theme provider, web/mobile component packages | Light/dark/system themes without duplicating visual rules; native components remain platform-appropriate. |
| API | NestJS + Fastify + OpenAPI | Modular, testable TypeScript API with validation, WebSocket support, queues, and a stable contract for web/mobile clients. |
| Database | PostgreSQL + PostGIS where location is required | Reliable transactional source of truth for tenant, project, workflow, finance, and audit data. |
| Data access | Prisma ORM with SQL migrations | Type-safe data access plus reviewed, repeatable migrations. |
| Files | S3-compatible encrypted object storage + signed URLs | Handles original documents, renditions, field media, retention, and scalable upload. |
| Asynchronous work | Redis + BullMQ workers | Separates OCR, PDF rendition, email sync, notifications, exports, AI indexing, and report generation from user requests. |
| Search and AI retrieval | PostgreSQL full-text + pgvector initially; dedicated search service only when scale requires it | Lower MVP operational complexity while retaining a migration path for high-volume search. |
| Identity | OIDC-based identity provider supporting MFA, SAML SSO, and SCIM | Supports mobile/web authentication today and enterprise identity later. |
| Observability | OpenTelemetry, structured logs, error tracking, metrics, and alerting | Traceable requests and background jobs from first release. |
| CI/CD | GitHub Actions; preview/staging/production environments; EAS for mobile builds and submissions | Automated testing and release control for web, API, and native applications. |

The backend begins as a modular monolith with independent worker processes. It will not be split into microservices until operational evidence requires that change. NestJS and BullMQ support separate asynchronous workers when document/AI processing load grows. [Next.js App Router](https://nextjs.org/docs/app), [Expo store builds](https://docs.expo.dev/build/setup/), [Expo distribution](https://docs.expo.dev/distribution/introduction/), [NestJS queues](https://docs.nestjs.com/techniques/queues)

## Store-release requirements

- Register Apple Developer and Google Play Console organization accounts; confirm legal entity, tax, banking, support URL, privacy policy, and app ownership.
- Reserve application identifiers, signing credentials, store listing names, domains, deep-link schemes, and support email addresses.
- Build native applications with EAS development, preview, and production profiles; use TestFlight and Google Play internal testing before public release.
- Include privacy nutrition labels / data-safety declarations, consent flows, account-deletion mechanism, crash reporting disclosure, and export-compliance answers.
- Test offline capture, camera, photo/video, notifications, deep links, and file upload on supported physical iOS and Android devices.

## Phase 1 decisions

### Market and commercial scope

- **Launch market:** Dehradun, Uttarakhand, India; the product and data model remain India-ready rather than Dehradun-specific.
- **Primary users:** contractors/construction firms, architects, owners, and their project teams. Phase 1 must support role-specific workspaces and external collaboration, not just architecture firms.
- **Commercial focus:** connected project delivery and administration plus comprehensive professional-services invoicing, payment tracking, and project accounting.
- **Construction cost boundary:** Phase 1 supports owner budgets, variations, commitments, and cost forecasting; it does not become a general-contractor ERP, payroll, or payment processor.

### Accounting and communication integrations

- **Email:** Gmail/Google Workspace is the first email integration.
- **Accounting:** QuickBooks Online is not available in India, so it cannot be the launch accounting integration. Select **Zoho Books** as the India-first accounting integration; retain a provider-neutral accounting adapter so QuickBooks can be added for non-India expansion. [QuickBooks India notice](https://quickbooks.intuit.com/in/)
- **WhatsApp:** WhatsApp Business Platform remains a Phase 2 integration; no personal-chat access.

### Local-first development and production path

- Develop and test locally using Docker Compose: PostgreSQL/PostGIS, Redis, MinIO (S3-compatible storage), Keycloak, API, workers, web, and mobile development builds.
- Select AWS as the production target, but defer account setup and paid infrastructure until the first pilot is ready. The default production region will be **ap-south-1 (Mumbai)**; it is in India and does not require region opt-in. AWS also has a Hyderabad region if customer or latency evidence warrants it. [AWS Regions](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html)
- Use Keycloak locally and in pilot deployment as the identity provider. It supports OIDC/OAuth 2.0 and SAML, avoiding identity-provider licensing costs while preserving enterprise federation options. [Keycloak administration guide](https://www.keycloak.org/docs/latest/server_admin/)

### Role and permission baseline

| Role | Core authority |
|---|---|
| Organization administrator | Organization settings, users, teams, policy, integrations, audit access. |
| Owner / principal | Portfolio, commercial controls, approvals, and reporting. |
| Finance administrator | Invoices, payments, project accounting, receivables, and exports. |
| Project director / manager | Project setup, plan, staffing, execution control, and permitted issuance. |
| Architect / engineer / CA lead | Documents, drawings, site records, RFIs, submittals, instructions, and assigned budgets. |
| Field supervisor | Offline site capture, issues, checklists, photos, and assigned work. |
| Contractor | Explicitly shared execution records; response, acknowledgement, and upload rights only. |
| Consultant / vendor | Explicitly shared records and workflow responses only. |
| Owner/client collaborator | Explicitly shared progress, decisions, approvals, cost, and reports only. |

All access is tenant-scoped, project-scoped, and record-classification-aware. Issued records, financial actions, permissions, exports, and AI actions require append-only audit events.

### Retention, audit, and AI policy

- Retain issued project records, audit events, invoices, payments, approvals, and financial exports for **seven years** after project close by default; allow an administrator to extend, but not silently shorten, retention for a project.
- Retain unissued drafts and raw transient uploads for 90 days by default unless they become a project record; provide deletion and legal-hold controls.
- Store personal and project data in India for the pilot. Apply consent, purpose limitation, access, correction, deletion, breach-response, and processor-record controls aligned to India's Digital Personal Data Protection Act, 2023. [India Code](https://www.indiacode.nic.in/show-data?abv=CEN&actid=AC_CEN_45_0_00003_2023-22_1763464807080&orderno=1&orgactid=AC_CEN_45_0_00003_2023-22_1763464807080&sectionId=101267&sectionno=1&statehandle=123456789%2F1362)
- AI is opt-in at organization level, permission-aware, citation-first, human-approved for consequential actions, and never trains a shared model on customer data without explicit consent. Prompt/source/output/model-version audit is required. No general AI chat is offered through WhatsApp.

## Phase 1 release plan

Phase 1 is the complete MVP, delivered through pilot increments rather than one unsafe big-bang release.

| Increment | Scope | Exit criteria |
|---|---|---|
| P1.0 Foundation | Monorepo, themes, web/mobile shells, Keycloak, tenancy, roles, audit, CI/CD, observability. | Secure user can create an organization, team, project, and authorized external collaborator. |
| P1.1 Project record | Project lifecycle, plan, tasks, documents/drawings, Gmail filing, communications, notifications. | Pilot team manages a real project record and finds current evidence. |
| P1.2 Execution and field | RFIs, submittals, instructions, issues, meetings, site visits, offline mobile capture, reports. | Pilot completes site observation-to-closure with complete audit history. |
| P1.3 Commercial control | Budget/planning, staffing, time, invoice, payment tracking, GST-ready fields, project accounting, owner cost/change control. | PM sees fee/cost variance and finance traces invoice/payment to source records. |
| P1.4 AI and readiness | Cited Project Brain, drafted reports/RFIs/minutes, secure retrieval, exports, pilot hardening, store-release testing. | AI citations/permissions pass evaluation; 3–5 partners complete usability validation. |

## Remaining product decisions before implementation

1. Confirm target launch geography, legal entities, data residency, currency, and contract terminology.
2. Select the MVP customer segment: 5–50-person architecture firms or 50–200-person multidisciplinary firms.
3. Confirm commercial scope: whether invoicing/payments are MVP or immediately post-MVP.
4. Select initial integration priorities: Gmail or Microsoft 365; QuickBooks Online or Xero; WhatsApp Business Phase 2.
5. Select the initial identity provider and cloud region/provider consistent with launch geography.
6. Define tenancy, roles, permission matrix, retention schedule, export policy, audit retention, and AI data-processing policy.
7. Define the canonical domain model and record-linking rules before persistence schema or UI work.
8. Prioritize the MVP backlog by user journey and write acceptance criteria for every deliverable.

## Required design work before build

1. Complete screen inventory for global, firm, project, field, and administration modules.
2. Produce user flows for proposal-to-project, project setup, drawing revision, site visit, issue/RFI/submittal, change event, invoice/payment, staffing allocation, and AI drafting/review.
3. Produce responsive wireframes and validate them with 3–5 target architecture firms.
4. Create the component library: tokens, typography, spacing, navigation, data tables, forms, workflow states, attachments, comments, mobile capture, and theme variants.
5. Define empty, loading, offline, permission-denied, conflict, error, and audit states.

## Required technical proof-of-concepts

1. Tenant isolation and role/project permission enforcement.
2. Offline field capture with encrypted local storage, resumable upload, and conflict handling.
3. Large PDF upload, virus scanning, rendition, metadata extraction, versioning, and 2D viewing.
4. Email ingestion and filing from the selected provider.
5. Auditable workflow state transition and immutable issued record.
6. Grounded, permission-aware AI retrieval with source citations and an approval gate.

## Delivery gates

| Gate | Evidence required |
|---|---|
| Product readiness | Prioritized MVP, approved personas, user journeys, acceptance criteria, and pilot partners. |
| Design readiness | Validated wireframes, component library, theme tokens, accessibility review, and mobile/offline states. |
| Architecture readiness | ADRs, threat model, data model, permission matrix, integration contracts, and POC outcomes. |
| Build readiness | Repository structure, CI/CD, environments, observability, test strategy, backlog, and release plan. |
