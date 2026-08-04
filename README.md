# Orbita AECO Platform

India-first architecture, construction, and project-delivery workspace.

## Local foundation

Prerequisites: Node 22+, pnpm 10+, and Docker Compose. If `corepack` is not
available on your machine, replace `pnpm` below with `npm exec pnpm@10.12.1 --`.

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health
- Keycloak: http://localhost:8180 (local admin credentials are for development only)
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

For the complete local service map, pilot account, workspace API check, and
separate web/API/mobile commands, see [the project setup and run guide](docs/project-setup-run-guide.md).
