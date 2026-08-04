import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import type { AuthenticatedActor, PlatformRole } from '@orbita/contracts';

interface ProjectRow extends QueryResultRow {
  id: string;
  code: string;
  name: string;
  status: string;
  location: string | null;
  stage: string;
}
interface TeamRow extends QueryResultRow {
  id: string;
  name: string;
}
interface MemberRow extends QueryResultRow {
  user_id: string;
  role: PlatformRole;
}

@Injectable()
export class WorkspaceService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://orbita:orbita_local@localhost:5432/orbita',
  });

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS teams (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (organization_id, name));
      CREATE TABLE IF NOT EXISTS projects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL REFERENCES organizations(id), code TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planning', location TEXT, stage TEXT NOT NULL DEFAULT 'planning', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (organization_id, code));
      CREATE TABLE IF NOT EXISTS project_members (project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id TEXT NOT NULL, role TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (project_id, user_id));
      CREATE TABLE IF NOT EXISTS audit_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    `);
  }
  async onModuleDestroy() {
    await this.pool.end();
  }

  async getWorkspace(actor: AuthenticatedActor) {
    await this.ensureOrganization(actor);
    const [projects, teams] = await Promise.all([
      this.pool.query<ProjectRow>(
        'SELECT id, code, name, status, location, stage FROM projects WHERE organization_id = $1 ORDER BY created_at DESC',
        [actor.organizationId],
      ),
      this.pool.query<TeamRow>(
        'SELECT id, name FROM teams WHERE organization_id = $1 ORDER BY name',
        [actor.organizationId],
      ),
    ]);
    return { organizationId: actor.organizationId, projects: projects.rows, teams: teams.rows };
  }
  async createOrganization(actor: AuthenticatedActor, name: string) {
    this.requireRole(actor, ['organization_admin', 'principal']);
    const organization = await this.pool.query<{ id: string; name: string }>(
      'INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
      [actor.organizationId, this.requiredText(name, 'Organization name')],
    );
    await this.audit(actor, 'organization.upserted', 'organization', actor.organizationId, {
      name,
    });
    return organization.rows[0];
  }
  async createTeam(actor: AuthenticatedActor, name: string) {
    this.requireRole(actor, ['organization_admin', 'principal']);
    await this.ensureOrganization(actor);
    const team = await this.pool.query<TeamRow>(
      'INSERT INTO teams (organization_id, name) VALUES ($1, $2) ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
      [actor.organizationId, this.requiredText(name, 'Team name')],
    );
    const created = this.resultRow(team.rows, 'Team could not be created.');
    await this.audit(actor, 'team.created', 'team', created.id, { name });
    return created;
  }
  async createProject(actor: AuthenticatedActor, input: CreateProjectInput) {
    this.requireRole(actor, ['organization_admin', 'principal', 'project_manager']);
    await this.ensureOrganization(actor);
    const project = await this.pool.query<ProjectRow>(
      'INSERT INTO projects (organization_id, code, name, location, stage) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, name, status, location, stage',
      [
        actor.organizationId,
        this.requiredText(input.code, 'Project code').toUpperCase(),
        this.requiredText(input.name, 'Project name'),
        input.location?.trim() || null,
        input.stage?.trim() || 'planning',
      ],
    );
    const created = this.resultRow(project.rows, 'Project could not be created.');
    await this.pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [
        created.id,
        actor.userId,
        actor.roles.includes('project_manager')
          ? 'project_manager'
          : (actor.roles[0] ?? 'project_member'),
      ],
    );
    await this.audit(actor, 'project.created', 'project', created.id, {
      code: created.code,
      name: created.name,
    });
    return created;
  }
  async addCollaborator(actor: AuthenticatedActor, projectId: string, input: AddCollaboratorInput) {
    this.requireRole(actor, ['organization_admin', 'principal', 'project_manager']);
    const project = await this.projectForActor(actor, projectId);
    const role = input.role as PlatformRole;
    if (
      ![
        'contractor',
        'consultant',
        'owner',
        'vendor',
        'project_member',
        'field_supervisor',
      ].includes(role)
    )
      throw new BadRequestException('Choose an external collaborator role.');
    const member = await this.pool.query<MemberRow>(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role RETURNING user_id, role',
      [project.id, this.requiredText(input.userId, 'Collaborator user ID'), role],
    );
    const added = this.resultRow(member.rows, 'Collaborator could not be added.');
    await this.audit(actor, 'project.collaborator_added', 'project', project.id, added);
    return added;
  }
  private async ensureOrganization(actor: AuthenticatedActor) {
    await this.pool.query(
      'INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [actor.organizationId, actor.organizationId],
    );
  }
  private async projectForActor(actor: AuthenticatedActor, projectId: string) {
    const result = await this.pool.query<ProjectRow>(
      'SELECT id, code, name, status, location, stage FROM projects WHERE id = $1 AND organization_id = $2',
      [projectId, actor.organizationId],
    );
    if (!result.rows[0])
      throw new BadRequestException('Project is unavailable in this organization.');
    return result.rows[0];
  }
  private requiredText(value: string, label: string) {
    const text = value?.trim();
    if (!text) throw new BadRequestException(`${label} is required.`);
    return text;
  }
  private resultRow<T extends QueryResultRow>(rows: T[], message: string) {
    const row = rows[0];
    if (!row) throw new BadRequestException(message);
    return row;
  }
  private requireRole(actor: AuthenticatedActor, allowed: PlatformRole[]) {
    if (!actor.roles.some((role) => allowed.includes(role)))
      throw new BadRequestException('You do not have permission for this workspace action.');
  }
  private async audit(
    actor: AuthenticatedActor,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.pool.query(
      'INSERT INTO audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [actor.organizationId, actor.userId, action, entityType, entityId, JSON.stringify(metadata)],
    );
  }
}
export interface CreateProjectInput {
  code: string;
  name: string;
  location?: string;
  stage?: string;
}
export interface AddCollaboratorInput {
  userId: string;
  role: string;
}
