# Orbita AECO Platform

India-first architecture, construction, and project-delivery workspace.

## Local foundation

Prerequisites: Node 22+, pnpm 10+, and Docker Compose. If `corepack` is not
available on your machine, run pnpm explicitly through npm:
`npm exec --yes --package=pnpm@10.12.1 -- pnpm`.

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

For example, without Corepack:

```bash
npm exec --yes --package=pnpm@10.12.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.12.1 -- pnpm dev
```

For local invitation emails, run `npm exec --yes --package=pnpm@10.12.1 -- pnpm setup:local-invitations` once after Docker is ready.

- Web: http://localhost:3000
- API health: http://localhost:3001/health
- Keycloak: http://localhost:8180 (local admin credentials are for development only)
- Mailpit local invitation inbox: http://localhost:8025
- MinIO console: http://localhost:9001

The imported development realm includes `pilot-admin` / `pilot_local` for the
`northline-studio` organization. These credentials are intentionally local-only
and must never be used outside development.

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

For a new-machine setup, verification checks, local Mailpit/Keycloak invitation
configuration, end-to-end invitation test, profile-photo test, workspace API check,
and separate web/API/mobile commands, see [the project setup and run guide](docs/project-setup-run-guide.md).

The product and delivery plan for organization creation, memberships, roles, staffing,
and pilot readiness is in the [organization onboarding plan](docs/organization-onboarding-plan.md).

## Local Phase 1 smoke test

With Docker Compose and the API already running, run:

```bash
pnpm smoke:phase1
```

It uses the local-only pilot account and creates one clearly named smoke project.
The test verifies tenant authentication, project records, document supersession,
idempotent email/mobile capture, execution workflows, finance, payments, and
cited Project Brain drafting. Override local endpoints or credentials only with
the `ORBITA_API_URL`, `ORBITA_KEYCLOAK_ISSUER`, `ORBITA_SMOKE_USERNAME`, and
`ORBITA_SMOKE_PASSWORD` environment variables.
