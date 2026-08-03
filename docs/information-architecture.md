# Platform Information Architecture

**Status:** Agreed design baseline  
**Date:** 4 August 2026

## 1. Purpose

This document defines the application structure for a broad architecture, engineering, construction-administration, and project-delivery platform. It is the navigation and screen-planning baseline for all future UX work.

The product must serve two connected operating levels:

1. **Firm operations:** people, pipeline, proposals, capacity, time, billing, payments, profitability, and reporting.
2. **Project delivery:** lifecycle planning, project execution, documents, construction administration, field work, owner cost controls, and closeout.

AI, communications, notifications, search, permissions, and auditability are cross-cutting services available throughout the platform.

## 2. Navigation model

### 2.1 Global application navigation

```text
Workspace
├── Home
│   ├── My work
│   ├── Notifications
│   └── AI project brain
├── Firm
│   ├── Team & staff directory
│   ├── Resource / capacity management
│   ├── Pipeline management
│   ├── Proposal builder
│   ├── Invoicing
│   ├── Payments
│   ├── Project accounting
│   └── Reports
├── Projects
│   ├── All projects
│   ├── Project lifecycle / stages
│   ├── Budget & planning
│   ├── Staffing & allocation
│   ├── Tasks & milestones
│   ├── Documents, drawings & communications
│   ├── Project execution
│   ├── Cost management
│   ├── Field work
│   └── Closeout / handover
└── Administration
    ├── Users, roles & permissions
    ├── Teams / offices
    ├── Integrations
    └── Templates / workflows
```

### 2.2 Persistent global controls

Every authenticated user shall have access to the following controls from application chrome, subject to permission:

| Control | Purpose |
|---|---|
| Organization switcher | Changes firm / workspace context. |
| Project switcher | Changes active project without losing global navigation. |
| Global search | Searches permitted projects, records, people, and communications. |
| Create action | Creates context-appropriate records: project, task, issue, RFI, time entry, invoice, etc. |
| AI project brain | Opens permission-aware search, drafting, review, and supervised agents. |
| Notifications | Shows assignments, deadlines, approvals, communication, integration, and AI events. |
| User menu | Shows profile, preferences, notification settings, connected accounts, and sign-out. |

## 3. Home

Home is a personal working surface, not a generic executive dashboard.

| Area | Required content |
|---|---|
| My work | Tasks, approvals, mentions, time-sheet prompts, overdue work, and items awaiting review. |
| Attention | Project risks and delivery, fee, staffing, payment, or decision alerts relevant to the user. |
| Recent context | Recently opened projects, drawings, records, documents, and communications. |
| Notifications | Prioritized, grouped, actionable notification feed. |
| AI project brain | Recent queries, saved prompts, drafts pending review, and context-aware entry point. |

## 4. Firm operations

### 4.1 Team and staff directory

Contains people profiles, discipline, role, office, manager, employment status, billable rate visibility by permission, current allocation, skills, certifications, and project assignments.

### 4.2 Resource and capacity management

Contains firm-wide and discipline-level capacity, allocations, planned versus actual utilization, staffing gaps, future demand, availability, leave, and scenario planning.

### 4.3 Pipeline management

Contains leads, opportunities, client contacts, probability, anticipated fees, stage, target dates, next action, proposal status, and revenue forecast.

### 4.4 Proposal builder

Contains scope, phases, fee, assumptions, exclusions, consultant quotations, staffing plan, client-facing proposal documents, version history, approvals, e-signature, and conversion to project.

### 4.5 Invoicing, payments, and project accounting

| Module | Primary purpose |
|---|---|
| Invoicing | Create, review, issue, resend, void, and track professional-services invoices. |
| Payments | Record, reconcile, and track client/consultant payments, collections, and aging. |
| Project accounting | Connect fee, time, expense, consultant cost, invoice, payment, WIP, write-off, realization, profit, and margin by project/phase. |

### 4.6 Firm reports

Includes portfolio performance, pipeline forecast, utilization, capacity, fee burn, realization, project profitability, invoicing, receivables, payment aging, and delivery-risk reporting.

## 5. Projects

### 5.1 Projects index

The projects index supports list, grid, and timeline views. Users can filter by lifecycle stage, office, client, principal, project manager, discipline, financial health, delivery health, project type, and date.

### 5.2 Project workspace navigation

```text
Project workspace
├── Overview
├── Lifecycle
├── Plan
├── Team & staffing
├── Tasks & milestones
├── Budget & planning
├── Project accounting
├── Cost management
├── Documents & drawings
├── Communications
├── Project execution
│   ├── RFIs
│   ├── Submittals
│   ├── Instructions
│   ├── Issues / observations
│   ├── Meetings
│   ├── Decisions
│   └── Change events
├── Field work
├── Closeout & handover
└── AI project brain
```

### 5.3 Project lifecycle

```text
Pursuit → Concept → Schematic Design → Design Development
→ Construction Documents → Tender / Procurement → Construction Administration
→ Handover → Warranty / Defects → Archived
```

Each stage has required deliverables, approvals, responsible roles, target dates, budget/fee controls, linked records, stage-entry criteria, and stage-exit criteria.

### 5.4 Planning, staffing, tasks, and milestones

| Module | Primary purpose |
|---|---|
| Plan | Scope, phases, deliverables, dependencies, schedule baseline, and planned milestones. |
| Team & staffing | Project roster, roles, allocation, planned hours, capacity gaps, consultants, and responsibility matrix. |
| Tasks & milestones | Actionable work, due dates, dependencies, ownership, completion, and links to source records. |
| Budget & planning | Approved fee, phase budgets, target hours, reimbursables, consultant allowances, and forecast. |

### 5.5 Financial views

Project financial functions must distinguish two views:

1. **Practice financials:** architecture/engineering fee, time, expenses, consultant cost, invoices, payments, WIP, profit, and margin.
2. **Construction cost management:** owner budget, commitments, variations, contingency, forecast-at-completion, payment/certification status, and cost-change impact.

The two views may link through a change event but must never be conflated.

### 5.6 Documents, drawings, and communications

Documents, drawings, email, Gmail, Microsoft 365 mail, WhatsApp Business messages, transmittals, comments, and meeting correspondence are linked project records—not disconnected folders.

Users can navigate from any record to its supporting evidence and from any document/drawing revision to the affected execution, financial, and field records.

### 5.7 Project execution

Project execution is the control centre for construction administration. It includes RFIs, submittals, instructions, issues/observations, meetings, decisions, and change events.

Each execution record provides a stable identifier, accountable parties, due dates, status, threaded communication, attachments, drawing/document references, audit history, and related tasks.

### 5.8 Field work

Field work is optimized for mobile/offline capture and desktop coordination. It includes site visits, observations, photos, video, voice notes, checklists, drawing pins, location/zone tags, issue creation, reports, signatures, and sync status.

### 5.9 Closeout and handover

Closeout contains outstanding items, punch-list status, warranties, O&M documentation, training records, asset/room records where enabled, handover approvals, and the final exportable project record.

## 6. Cross-cutting services

### 6.1 AI project brain

AI is available from global, project, and record context. It provides cited answers, multimodal capture drafting, document metadata extraction, drawing/revision comparison, workflow preparation, and risk signals. It is permission-aware and human-approved for any consequential action.

### 6.2 Communications and notifications

Communications is a unified record of permitted email, Gmail, Microsoft 365, WhatsApp Business, comments, transmittals, and external correspondence. Notifications route work to users through in-app, email, and enabled push/business-messaging channels without replacing the underlying workflow record.

### 6.3 Administration

Administration controls users, roles, permissions, offices, teams, templates, workflow rules, numbering, retention, notifications, AI policy, integrations, API access, audit events, and organization settings.

## 7. UX rules

1. Every global module must have a clear primary job and a first-class navigation destination.
2. Every project module must retain visible project context and allow a return to portfolio/workspace context.
3. A record should be reachable from its related document, communication, task, drawing, cost item, field observation, and AI result.
4. User/team/project information is never hidden behind a generic dashboard; it has dedicated views and role-appropriate detail.
5. AI enhances a workflow in context; it does not replace navigation, records, approvals, or accountability.
6. Financial data is permission-sensitive and practice financials remain distinct from owner construction costs.
7. Field interfaces prioritize capture and offline resilience; web interfaces prioritize coordination, review, and control.
