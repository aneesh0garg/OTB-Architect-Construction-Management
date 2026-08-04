import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor, PlatformRole } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { DocumentUploadService } from './document-upload.service.js';

interface ProjectRow extends QueryResultRow {
  id: string;
  code: string;
  name: string;
  status: string;
  location: string | null;
  stage: string;
  closed_at: Date | null;
  retention_until: Date | null;
}
interface TeamRow extends QueryResultRow {
  id: string;
  name: string;
}
interface MemberRow extends QueryResultRow {
  user_id: string;
  role: PlatformRole;
}
interface TaskRow extends QueryResultRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
}
interface DocumentRow extends QueryResultRow {
  id: string;
  document_number: string;
  document_type: string;
  title: string;
  revision: string;
  status: string;
  issue_date: string | null;
}
interface CommunicationRow extends QueryResultRow {
  id: string;
  channel: string;
  direction: string;
  subject: string;
  body: string;
  sender: string;
  recipients: string[];
  filed_at: Date;
}
interface NotificationRow extends QueryResultRow {
  id: string;
  event_type: string;
  title: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
}
interface AuditRow extends QueryResultRow {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}
export const projectStages = [
  'pursuit',
  'concept',
  'schematic_design',
  'design_development',
  'construction_documents',
  'tender',
  'construction_administration',
  'handover',
  'warranty_defects',
  'archived',
] as const;
export type ProjectStage = (typeof projectStages)[number];

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly pool: DatabaseService,
    private readonly uploads: DocumentUploadService,
  ) {}

  async getWorkspace(actor: AuthenticatedActor) {
    await this.ensureOrganization(actor);
    const [projects, teams] = await Promise.all([
      this.pool.query<ProjectRow>(
        'SELECT id, code, name, status, location, stage, closed_at, retention_until FROM projects WHERE organization_id = $1 ORDER BY created_at DESC',
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
      'INSERT INTO projects (organization_id, code, name, location, stage) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, name, status, location, stage, closed_at, retention_until',
      [
        actor.organizationId,
        this.requiredText(input.code, 'Project code').toUpperCase(),
        this.requiredText(input.name, 'Project name'),
        input.location?.trim() || null,
        this.projectStage(input.stage),
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
  async transitionProjectStatus(actor: AuthenticatedActor, projectId: string, status: string) {
    this.requireRole(actor, ['organization_admin', 'principal', 'project_manager']);
    const project = await this.projectForActor(actor, projectId);
    const allowed: Record<string, string[]> = {
      planning: ['active', 'on_hold'],
      active: ['on_hold', 'closed'],
      on_hold: ['active', 'closed'],
      closed: ['archived'],
      archived: [],
    };
    if (!allowed[project.status]?.includes(status))
      throw new BadRequestException(
        `Project status cannot change from ${project.status} to ${status}.`,
      );
    const result = await this.pool.query<ProjectRow>(
      `UPDATE projects
       SET status = $1,
           closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE closed_at END,
           retention_until = CASE WHEN $1 = 'closed' THEN NOW() + INTERVAL '7 years' ELSE retention_until END
       WHERE id = $2 AND organization_id = $3
       RETURNING id, code, name, status, location, stage, closed_at, retention_until`,
      [status, projectId, actor.organizationId],
    );
    const updated = this.resultRow(result.rows, 'Project is unavailable.');
    await this.audit(actor, 'project.status_changed', 'project', updated.id, {
      projectId: updated.id,
      fromStatus: project.status,
      toStatus: updated.status,
      retentionUntil: updated.retention_until,
    });
    return updated;
  }
  async transitionProjectStage(actor: AuthenticatedActor, projectId: string, stage: ProjectStage) {
    this.requireRole(actor, ['organization_admin', 'principal', 'project_manager']);
    const project = await this.projectForActor(actor, projectId);
    const nextStage = this.projectStage(stage);
    if (project.stage === nextStage) return project;
    const updated = await this.pool.query<ProjectRow>(
      `UPDATE projects SET stage = $1
       WHERE id = $2 AND organization_id = $3
       RETURNING id, code, name, status, location, stage, closed_at, retention_until`,
      [nextStage, project.id, actor.organizationId],
    );
    const value = this.resultRow(updated.rows, 'Project is unavailable.');
    await this.audit(actor, 'project.stage_changed', 'project', value.id, {
      projectId: value.id,
      fromStage: project.stage,
      toStage: value.stage,
    });
    return value;
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
  async removeCollaborator(actor: AuthenticatedActor, projectId: string, userId: string) {
    this.requireRole(actor, ['organization_admin', 'principal', 'project_manager']);
    const project = await this.projectForActor(actor, projectId);
    const removed = await this.pool.query<MemberRow>(
      `DELETE FROM project_members
       WHERE project_id = $1 AND user_id = $2
         AND role IN ('contractor', 'consultant', 'owner', 'vendor', 'project_member', 'field_supervisor')
       RETURNING user_id, role`,
      [project.id, this.requiredText(userId, 'Collaborator user ID')],
    );
    const collaborator = this.resultRow(removed.rows, 'Collaborator is unavailable for removal.');
    await this.audit(actor, 'project.collaborator_removed', 'project', project.id, collaborator);
    return collaborator;
  }
  async getProjectRecord(actor: AuthenticatedActor, projectId: string) {
    const project = await this.projectForActor(actor, projectId);
    const [tasks, documents, communications] = await Promise.all([
      this.pool.query<TaskRow>(
        'SELECT id, title, status, priority, due_date, assignee_id FROM tasks WHERE project_id = $1 ORDER BY due_date NULLS LAST, created_at DESC',
        [project.id],
      ),
      this.pool.query<DocumentRow>(
        'SELECT id, document_number, document_type, title, revision, status, issue_date FROM document_revisions WHERE project_id = $1 ORDER BY document_number, created_at DESC',
        [project.id],
      ),
      this.pool.query<CommunicationRow>(
        'SELECT id, channel, direction, subject, body, sender, recipients, filed_at FROM communications WHERE project_id = $1 AND filing_status = $2 ORDER BY filed_at DESC',
        [project.id, 'filed'],
      ),
    ]);
    return {
      project,
      tasks: tasks.rows,
      documents: documents.rows,
      communications: communications.rows,
    };
  }
  async createTask(actor: AuthenticatedActor, projectId: string, input: CreateTaskInput) {
    const project = await this.projectForActor(actor, projectId);
    const task = await this.pool.query<TaskRow>(
      'INSERT INTO tasks (organization_id, project_id, title, priority, due_date, assignee_id, source_record_type, source_record_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, title, status, priority, due_date, assignee_id',
      [
        actor.organizationId,
        project.id,
        this.requiredText(input.title, 'Task title'),
        input.priority ?? 'normal',
        input.dueDate ?? null,
        input.assigneeId ?? null,
        input.sourceRecordType ?? null,
        input.sourceRecordId ?? null,
        actor.userId,
      ],
    );
    const created = this.resultRow(task.rows, 'Task could not be created.');
    await this.notify(
      actor.organizationId,
      input.assigneeId,
      project.id,
      'task.assigned',
      'New project task',
      created.title,
    );
    await this.audit(actor, 'task.created', 'task', created.id, {
      projectId: project.id,
      priority: created.priority,
    });
    return created;
  }
  async addDocumentRevision(
    actor: AuthenticatedActor,
    projectId: string,
    input: CreateDocumentInput,
  ) {
    this.requireRole(actor, [
      'organization_admin',
      'principal',
      'project_manager',
      'project_member',
    ]);
    const project = await this.projectForActor(actor, projectId);
    const number = this.requiredText(input.documentNumber, 'Document number').toUpperCase();
    const storageKey = input.uploadId
      ? await this.uploads.consume(actor, projectId, input.uploadId)
      : null;
    if (input.status === 'issued')
      await this.pool.query(
        'UPDATE document_revisions SET status = $1 WHERE project_id = $2 AND document_number = $3 AND status = $4',
        ['superseded', project.id, number, 'issued'],
      );
    const document = await this.pool.query<DocumentRow>(
      'INSERT INTO document_revisions (organization_id, project_id, document_number, document_type, title, revision, status, issue_date, storage_key, issuer_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, document_number, document_type, title, revision, status, issue_date',
      [
        actor.organizationId,
        project.id,
        number,
        input.documentType,
        this.requiredText(input.title, 'Document title'),
        this.requiredText(input.revision, 'Revision'),
        input.status ?? 'draft',
        input.issueDate ?? null,
        storageKey,
        actor.userId,
      ],
    );
    const created = this.resultRow(document.rows, 'Document revision could not be created.');
    await this.audit(actor, 'document.revision_created', 'document_revision', created.id, {
      projectId: project.id,
      number,
      revision: created.revision,
    });
    return created;
  }
  async fileCommunication(
    actor: AuthenticatedActor,
    projectId: string,
    input: FileCommunicationInput,
  ) {
    const project = await this.projectForActor(actor, projectId);
    if (input.sourceMessageId) {
      const existing = await this.pool.query<CommunicationRow>(
        'SELECT id, channel, direction, subject, body, sender, recipients, filed_at FROM communications WHERE project_id = $1 AND source_message_id = $2',
        [project.id, input.sourceMessageId],
      );
      if (existing.rows[0]) return existing.rows[0];
    }
    const communication = await this.pool.query<CommunicationRow>(
      'INSERT INTO communications (organization_id, project_id, channel, direction, subject, body, sender, recipients, thread_id, source_message_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, channel, direction, subject, body, sender, recipients, filed_at',
      [
        actor.organizationId,
        project.id,
        input.channel,
        input.direction,
        this.requiredText(input.subject, 'Subject'),
        this.requiredText(input.body, 'Message body'),
        this.requiredText(input.sender, 'Sender'),
        input.recipients,
        input.threadId ?? null,
        input.sourceMessageId ?? null,
      ],
    );
    const filed = this.resultRow(communication.rows, 'Communication could not be filed.');
    await this.audit(actor, 'communication.filed', 'communication', filed.id, {
      projectId: project.id,
      channel: filed.channel,
    });
    return filed;
  }
  async getNotifications(actor: AuthenticatedActor) {
    const notifications = await this.pool.query<NotificationRow>(
      'SELECT id, event_type, title, body, read_at, created_at FROM notifications WHERE organization_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50',
      [actor.organizationId, actor.userId],
    );
    return notifications.rows;
  }
  async markNotificationRead(actor: AuthenticatedActor, notificationId: string) {
    const notification = await this.pool.query<NotificationRow>(
      'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND organization_id = $2 AND user_id = $3 RETURNING id, event_type, title, body, read_at, created_at',
      [notificationId, actor.organizationId, actor.userId],
    );
    return this.resultRow(notification.rows, 'Notification is unavailable.');
  }
  async getAuditEvents(actor: AuthenticatedActor, projectId?: string) {
    this.requireRole(actor, ['organization_admin', 'principal']);
    if (projectId) await this.projectForActor(actor, projectId);
    const events = await this.pool.query<AuditRow>(
      projectId
        ? "SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at FROM audit_events WHERE organization_id = $1 AND metadata->>'projectId' = $2 ORDER BY created_at DESC LIMIT 200"
        : 'SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at FROM audit_events WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 200',
      projectId ? [actor.organizationId, projectId] : [actor.organizationId],
    );
    return events.rows;
  }
  private async ensureOrganization(actor: AuthenticatedActor) {
    await this.pool.query(
      'INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [actor.organizationId, actor.organizationId],
    );
  }
  private async projectForActor(actor: AuthenticatedActor, projectId: string) {
    const result = await this.pool.query<ProjectRow>(
      'SELECT id, code, name, status, location, stage, closed_at, retention_until FROM projects WHERE id = $1 AND organization_id = $2',
      [projectId, actor.organizationId],
    );
    const project = result.rows[0];
    if (!project) throw new BadRequestException('Project is unavailable in this organization.');
    if (
      !actor.roles.some((role) =>
        ['organization_admin', 'principal', 'finance_admin', 'project_manager'].includes(role),
      )
    ) {
      const member = await this.pool.query<MemberRow>(
        'SELECT user_id, role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [project.id, actor.userId],
      );
      if (!member.rows[0]) throw new BadRequestException('Project membership is required.');
    }
    return project;
  }
  private requiredText(value: string, label: string) {
    const text = value?.trim();
    if (!text) throw new BadRequestException(`${label} is required.`);
    return text;
  }
  private projectStage(value: string | undefined): ProjectStage {
    const stage = value?.trim() || 'pursuit';
    if (!projectStages.includes(stage as ProjectStage))
      throw new BadRequestException(`Choose a valid project stage: ${projectStages.join(', ')}.`);
    return stage as ProjectStage;
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
  private async notify(
    organizationId: string,
    userId: string | undefined,
    projectId: string,
    eventType: string,
    title: string,
    body: string,
  ) {
    if (!userId) return;
    await this.pool.query(
      'INSERT INTO notifications (organization_id, user_id, project_id, event_type, title, body) VALUES ($1, $2, $3, $4, $5, $6)',
      [organizationId, userId, projectId, eventType, title, body],
    );
  }
}
export interface CreateProjectInput {
  code: string;
  name: string;
  location?: string;
  stage?: ProjectStage;
}
export interface AddCollaboratorInput {
  userId: string;
  role: string;
}
export interface CreateTaskInput {
  title: string;
  priority?: string;
  dueDate?: string;
  assigneeId?: string;
  sourceRecordType?: string;
  sourceRecordId?: string;
}
export interface CreateDocumentInput {
  documentNumber: string;
  documentType: string;
  title: string;
  revision: string;
  status?: string;
  issueDate?: string;
  uploadId?: string;
}
export interface FileCommunicationInput {
  channel: string;
  direction: string;
  subject: string;
  body: string;
  sender: string;
  recipients: string[];
  threadId?: string;
  sourceMessageId?: string;
}
