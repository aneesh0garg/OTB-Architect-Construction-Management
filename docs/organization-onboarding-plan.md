# Organization onboarding plan

## Outcome

Turn an authenticated principal into a securely configured organization with firm
defaults, active members, one delivery team, and a first project. An organization is the
tenant boundary; organization roles are separate from project roles and assignments.

```text
Create organization → Configure defaults → Verify owner
→ Invite members → Activate membership → Staff project → Ready workspace
```

## Stages

| Stage | Actor | Result | Guardrail |
| --- | --- | --- | --- |
| Create organization | Principal | Tenant and initial administrator | Tenant/audit record created once. |
| Configure firm | Organization admin | Office, INR/time zone, GST, numbering, retention defaults | Issuance blocked until required defaults are reviewed. |
| Confirm identity | Initial admin | Verified email, password, MFA where policy requires | Keycloak owns credentials; Orbita never stores passwords. |
| Invite member | Organization admin | Pending membership and activation mail | Email, role, expiry, resend/revoke, and audit retained. |
| Activate | Invited member | Active authorized membership | Selected organization role is mapped into Keycloak token. |
| Directory/capacity | Resource manager | Name, title, role, capacity, profile photo | Internal identity IDs not shown in normal UI. |
| Project staffing | Project manager | Project roster and responsibility | Only active organization members can be assigned. |
| Readiness | Organization admin | First project controlled and operational | Integrations and AI are explicit opt-ins. |

## Core flows

### Create and configure

The principal enters organization name, type (contractor, architecture/engineering,
owner, consultant), country/state, time zone, base currency, and optional GSTIN. A
skippable checklist then covers office/contact identity, working week/capacity defaults,
document/drawing/task numbering, retention/export contact, notifications, integrations,
and AI policy.

### Invite and activate people

An admin enters work email, name, organization role, title, and weekly capacity. The
server creates or reuses the Keycloak identity, maps the selected role into the Keycloak
token, writes a pending membership, sends a time-limited activation email, and audits the
action. The directory exposes pending, active, expired, revoked, and suspended states.

The recipient verifies email, chooses their own password, and completes required MFA.
When testing locally, the link must open in a private window or after signing out of the
current Keycloak user; Keycloak intentionally blocks cross-user activation in one SSO
session.

### Staff a project

Organization membership never grants project access by itself. A resource/project manager
selects active members for the project’s one delivery team and assigns a project-specific
responsibility. Pending, revoked, expired, or suspended members cannot be staffed or
receive project records.

## Roles

| Role | Organization administration | Project staffing |
| --- | --- | --- |
| Organization administrator / principal | Members, roles, teams, integrations, retention | Full within policy |
| Project manager | Members within authority; no privilege escalation | Team/role assignment within authority |
| Finance administrator | Financial administration only | No default staffing authority |
| Project member / field supervisor | No member administration | No staffing authority |
| Contractor, consultant, owner, vendor | Controlled external access only | No staffing authority |

## Delivery phases

### O1 — Foundation

- Email invitation, activation, role-to-Keycloak mapping, pending membership, audit, and
  mobile success/error feedback.
- Permission-controlled JPEG/PNG/WebP profile photo upload.
- **Accept:** invited user activates, signs in, reaches an authorized workspace, and can
  be assigned to a project. Authorization errors never appear as a session-expiry error.

### O2 — Tenant administration

- Organization creation wizard, firm defaults, resend/revoke/suspend, profile, effective
  permissions, and audit history.
- **Accept:** one membership can be changed without affecting a second organization.

### O3 — Multi-organization and staffing

- Organization picker, server-verified context switch, projects index, dedicated roster,
  allocations, capacity conflicts, and controlled external collaborators.
- **Accept:** no cross-tenant project, file, notification, or AI result is visible.

### O4 — Pilot readiness

- MFA for pilot admins, verified sender, support/recovery, terms/privacy, retention,
  observability, and two-user physical-device scenarios.
- **Accept:** 3–5 design partners complete onboarding without administrator-created
  passwords or untracked access grants.

## Test matrix

| Scenario | Evidence |
| --- | --- |
| New owner | Tenant, owner role, defaults, and audit created idempotently. |
| New internal invite | Email arrives; token contains selected role; first login opens workspace. |
| Existing identity, new organization | Identity reused; memberships remain isolated. |
| Different active SSO session | Clear guidance; cross-user activation is rejected. |
| Expired/revoked/suspended member | Explicit recoverable denial; no project access. |
| Mobile LAN | Sign-in, invite, activation, profile photo, and project staffing work on device. |
| Permission boundary | Non-admin cannot invite, change roles, or staff project members. |

## Pilot decisions

1. Whether GSTIN is optional at creation but required before invoicing.
2. MFA scope: mandatory for administrators and optional/mandatory for all members.
3. Production sender domain, recovery/support channel, invite expiry, and offboarding policy.
4. Self-serve, sales-assisted, or invitation-only organization creation for the Dehradun pilot.
