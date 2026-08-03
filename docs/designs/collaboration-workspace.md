# Collaboration Workspace Design

**Status:** Design direction approved for iteration 1  
**Companion specifications:** [SRS](../software-requirements-specification.md), [Information Architecture](../information-architecture.md)

## Intent

The product should feel like a shared, persistent workspace—not a collection of isolated construction forms. The interaction model borrows the immediacy of a team collaboration tool while keeping every conversation, task, decision, drawing, and financial action attached to its formal project record.

## Application shell

| Region | Purpose |
|---|---|
| Top bar | Organization identity, global search, notifications, connected user identity, and user settings. |
| Mode rail | Fast switching between collaboration, projects, personal work, practice operations, and AI project brain. |
| Workspace navigation | Projects/teams plus the user’s current collaboration context. |
| Main canvas | The selected workspace, project channel, operational module, or record. |

## Workspace structure

```text
Collaboration workspace
├── Activity
├── My work
├── Chat
├── Teams and projects
│   ├── Ridge House
│   │   ├── Posts
│   │   ├── Files
│   │   ├── Drawings
│   │   ├── Execution
│   │   ├── Budget
│   │   └── Plan
│   └── Other projects
├── Practice operations
│   ├── Team and resources
│   ├── Pipeline and proposals
│   ├── Invoicing and payments
│   └── Project accounting
└── AI project brain
```

## Key experiences

### Project collaboration channel

The project channel presents a discussion and activity feed. A post may contain or link to formal records such as an issue, RFI, submittal, decision, drawing revision, site report, task, invoice, or change event. The linked record remains the source of truth; the post provides collaboration and awareness.

### My work

Aggregates a user's tasks, approvals, mentions, time-sheet prompts, overdue items, and records awaiting review across all accessible projects. Each item opens the source record in the correct project context.

### Project workspace

Projects retain their lifecycle, plan, staffing, budget, accounting, cost, documents, communications, execution, field, closeout, and AI modules as defined in the information architecture. The collaboration channel is the shared entry point, not a replacement for those modules.

### Practice operations

Firm operations expose team capacity, pipeline, proposal work, invoicing, payment aging, and project accounting as explicit modules. They must never be hidden solely inside a high-level dashboard.

### AI project brain

AI is reachable from the mode rail, global search, project channel, and any individual record. It supplies cited answers and drafts; it does not issue or approve contractual/financial actions without the normal human workflow.

## Design rules

1. User identity, active organization, project context, and member presence are always clear.
2. A collaboration message never loses its link to the formal record it references.
3. Tasks and approvals can be created from a message, AI draft, document, drawing, or workflow record.
4. The visual emphasis is on current work and shared awareness, then drill-down control.
5. Financial and contractual actions retain stronger permission, approval, and audit treatment than informal conversation.
6. The field experience remains mobile-first and offline-capable; the workspace supports coordination, review, and reporting.

## Theme and visual system

The workspace shall support **light**, **dark**, and **system** themes. Theme selection is a user preference; organizations may provide a default only. No workflow state may be communicated by color alone.

Implementation shall use semantic tokens (for example, `surface`, `surface-raised`, `text-primary`, `text-secondary`, `border`, `action-primary`, `status-warning`, and `focus-ring`) rather than component-level color literals. Tokens must support accessible contrast in every theme and can later enable organization branding without forking components.

## Next design deliverables

1. Full screen inventory for every global and project module.
2. Detailed flows for project creation, proposal-to-project conversion, RFI, submittal, issue, field visit, invoice, payment, and staffing allocation.
3. Responsive desktop and mobile wireframes.
4. High-fidelity component library and clickable prototype.
