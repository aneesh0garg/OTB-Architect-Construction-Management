import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor, PlatformRole } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { DocumentUploadService } from './document-upload.service.js';
import { NotificationService } from './notification.service.js';

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
interface ProjectMemberRow extends MemberRow {
  display_name: string | null;
  title: string | null;
}
interface TaskRow extends QueryResultRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string;
}
interface PersonalTaskRow extends TaskRow {
  project_id: string;
  project_code: string;
  project_name: string;
}
interface DocumentRow extends QueryResultRow {
  id: string;
  document_number: string;
  document_type: string;
  title: string;
  revision: string;
  status: string;
  issue_date: string | null;
  discipline: string | null;
  building: string | null;
  floor: string | null;
  zone: string | null;
  content_sha256: string | null;
  has_original: boolean;
  created_at: Date;
}
interface TransmittalRow extends QueryResultRow {
  id: string;
  transmittal_number: number;
  purpose: string;
  issue_note: string | null;
  recipients: string[];
  document_ids: string[];
  created_at: Date;
}
interface DocumentAnnotationRow extends QueryResultRow {
  id: string;
  page_number: number;
  x_percent: number | null;
  y_percent: number | null;
  body: string;
  created_by: string;
  created_at: Date;
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
interface NotificationPreferenceRow extends QueryResultRow {
  event_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_frequency: string;
  updated_at: Date;
}
interface UpdateNotificationPreferenceInput {
  eventType: string;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  digestFrequency?: string;
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
    private readonly notifications: NotificationService,
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
    await this.audit(actor, 'project.collaborator_added', 'project', project.id, {
      ...added,
      projectId: project.id,
    });
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
    await this.audit(actor, 'project.collaborator_removed', 'project', project.id, {
      ...collaborator,
      projectId: project.id,
    });
    return collaborator;
  }
  async getProjectRecord(actor: AuthenticatedActor, projectId: string) {
    const project = await this.projectForActor(actor, projectId);
    const [tasks, documents, communications, transmittals, members] = await Promise.all([
      this.pool.query<TaskRow>(
        'SELECT id, title, status, priority, due_date, assignee_id, created_by FROM tasks WHERE project_id = $1 ORDER BY due_date NULLS LAST, created_at DESC',
        [project.id],
      ),
      this.pool.query<DocumentRow>(
        'SELECT id, document_number, document_type, title, revision, status, issue_date, discipline, building, floor, zone, content_sha256, storage_key IS NOT NULL AS has_original, created_at FROM document_revisions WHERE project_id = $1 ORDER BY document_number, created_at DESC',
        [project.id],
      ),
      this.pool.query<CommunicationRow>(
        'SELECT id, channel, direction, subject, body, sender, recipients, filed_at FROM communications WHERE project_id = $1 AND filing_status = $2 ORDER BY filed_at DESC',
        [project.id, 'filed'],
      ),
      this.pool.query<TransmittalRow>(
        'SELECT id, transmittal_number, purpose, issue_note, recipients, document_ids, created_at FROM document_transmittals WHERE project_id = $1 ORDER BY created_at DESC',
        [project.id],
      ),
      this.projectMembers(project.id, actor.organizationId),
    ]);
    return {
      project,
      tasks: tasks.rows,
      documents: documents.rows,
      communications: communications.rows,
      transmittals: transmittals.rows,
      members,
    };
  }
  async getProjectCollaborators(actor: AuthenticatedActor, projectId: string) {
    const project = await this.projectForActor(actor, projectId);
    return this.projectMembers(project.id, actor.organizationId);
  }
  async createTask(actor: AuthenticatedActor, projectId: string, input: CreateTaskInput) {
    const project = await this.projectForActor(actor, projectId);
    const task = await this.pool.query<TaskRow>(
      'INSERT INTO tasks (organization_id, project_id, title, priority, due_date, assignee_id, source_record_type, source_record_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, title, status, priority, due_date, assignee_id, created_by',
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
    await this.notifications.notifyUser(
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
  async getMyTasks(actor: AuthenticatedActor) {
    const tasks = await this.pool.query<PersonalTaskRow>(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assignee_id, t.created_by,
          t.project_id, p.code AS project_code, p.name AS project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id AND p.organization_id = t.organization_id
       JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $2
       WHERE t.organization_id = $1 AND t.assignee_id = $2
       ORDER BY t.due_date NULLS LAST, t.created_at DESC`,
      [actor.organizationId, actor.userId],
    );
    return tasks.rows;
  }
  async transitionTaskStatus(
    actor: AuthenticatedActor,
    projectId: string,
    taskId: string,
    status: string,
  ) {
    const project = await this.projectForActor(actor, projectId);
    const task = await this.pool.query<TaskRow>(
      `SELECT id, title, status, priority, due_date, assignee_id, created_by
       FROM tasks WHERE id = $1 AND project_id = $2 AND organization_id = $3`,
      [taskId, project.id, actor.organizationId],
    );
    const current = this.resultRow(task.rows, 'Task is unavailable.');
    const canManageTasks = actor.roles.some((role) =>
      ['organization_admin', 'principal', 'project_manager'].includes(role),
    );
    if (
      !canManageTasks &&
      current.assignee_id !== actor.userId &&
      current.created_by !== actor.userId
    )
      throw new BadRequestException(
        'Only the task assignee, task creator, or a project manager can change this task.',
      );
    const allowed: Record<string, string[]> = {
      open: ['in_progress', 'blocked', 'completed', 'cancelled'],
      in_progress: ['blocked', 'completed', 'cancelled'],
      blocked: ['in_progress', 'completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };
    if (!allowed[current.status]?.includes(status))
      throw new BadRequestException(
        `Task status cannot change from ${current.status} to ${status}.`,
      );
    const result = await this.pool.query<TaskRow>(
      `UPDATE tasks SET status = $1 WHERE id = $2 AND project_id = $3
       RETURNING id, title, status, priority, due_date, assignee_id, created_by`,
      [status, current.id, project.id],
    );
    const updated = this.resultRow(result.rows, 'Task is unavailable.');
    await this.audit(actor, 'task.status_changed', 'task', updated.id, {
      projectId: project.id,
      fromStatus: current.status,
      toStatus: updated.status,
    });
    return updated;
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
    const upload = input.uploadId
      ? await this.uploads.consume(actor, projectId, input.uploadId)
      : { storageKey: null, checksumSha256: null };
    if (input.status === 'issued')
      await this.pool.query(
        'UPDATE document_revisions SET status = $1 WHERE project_id = $2 AND document_number = $3 AND status = $4',
        ['superseded', project.id, number, 'issued'],
      );
    const document = await this.pool.query<DocumentRow>(
      `INSERT INTO document_revisions (organization_id, project_id, document_number, document_type,
        title, revision, status, issue_date, discipline, building, floor, zone, storage_key, content_sha256, issuer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, document_number, document_type, title, revision, status, issue_date,
         discipline, building, floor, zone, content_sha256`,
      [
        actor.organizationId,
        project.id,
        number,
        input.documentType,
        this.requiredText(input.title, 'Document title'),
        this.requiredText(input.revision, 'Revision'),
        input.status ?? 'draft',
        input.issueDate ?? null,
        input.discipline?.trim() || null,
        input.building?.trim() || null,
        input.floor?.trim() || null,
        input.zone?.trim() || null,
        upload.storageKey,
        upload.checksumSha256,
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
  async issueDocumentRevision(actor: AuthenticatedActor, projectId: string, documentId: string) {
    this.requireRole(actor, [
      'organization_admin',
      'principal',
      'project_manager',
      'project_member',
    ]);
    const project = await this.projectForActor(actor, projectId);
    const existing = await this.pool.query<DocumentRow>(
      `SELECT id, document_number, document_type, title, revision, status, issue_date,
        discipline, building, floor, zone
       FROM document_revisions
       WHERE id = $1 AND project_id = $2 AND organization_id = $3`,
      [documentId, project.id, actor.organizationId],
    );
    const draft = this.resultRow(existing.rows, 'Document revision is unavailable.');
    if (!['draft', 'approved'].includes(draft.status))
      throw new BadRequestException('Only a draft or approved document revision can be issued.');
    await this.pool.query(
      `UPDATE document_revisions SET status = 'superseded'
       WHERE project_id = $1 AND organization_id = $2 AND document_number = $3 AND status = 'issued'`,
      [project.id, actor.organizationId, draft.document_number],
    );
    const issued = await this.pool.query<DocumentRow>(
      `UPDATE document_revisions
       SET status = 'issued', issue_date = COALESCE(issue_date, CURRENT_DATE)
       WHERE id = $1 AND project_id = $2 AND organization_id = $3
       RETURNING id, document_number, document_type, title, revision, status, issue_date,
         discipline, building, floor, zone`,
      [draft.id, project.id, actor.organizationId],
    );
    const document = this.resultRow(issued.rows, 'Document revision could not be issued.');
    await this.audit(actor, 'document.revision_issued', 'document_revision', document.id, {
      projectId: project.id,
      documentNumber: document.document_number,
      revision: document.revision,
    });
    return document;
  }
  async reviewDocumentRevision(
    actor: AuthenticatedActor,
    projectId: string,
    documentId: string,
    input: { action: 'submit' | 'approve' | 'reject'; comment?: string },
  ) {
    const project = await this.projectForActor(actor, projectId);
    const documentResult = await this.pool.query<DocumentRow>(
      `SELECT id, document_number, document_type, title, revision, status, issue_date,
        discipline, building, floor, zone, content_sha256, storage_key IS NOT NULL AS has_original
       FROM document_revisions WHERE id = $1 AND project_id = $2 AND organization_id = $3`,
      [documentId, project.id, actor.organizationId],
    );
    const document = this.resultRow(documentResult.rows, 'Document revision is unavailable.');
    const transitions = {
      submit: { from: 'draft', to: 'internal_review' },
      approve: { from: 'internal_review', to: 'approved' },
      reject: { from: 'internal_review', to: 'draft' },
    } as const;
    const transition = transitions[input.action];
    if (document.status !== transition.from)
      throw new BadRequestException(`Document cannot be ${input.action}d from ${document.status}.`);
    if (input.action !== 'submit')
      this.requireRole(actor, ['organization_admin', 'principal', 'project_manager']);
    const updated = await this.pool.query<DocumentRow>(
      `UPDATE document_revisions SET status = $1 WHERE id = $2 AND project_id = $3 AND organization_id = $4
       RETURNING id, document_number, document_type, title, revision, status, issue_date,
         discipline, building, floor, zone, content_sha256, storage_key IS NOT NULL AS has_original`,
      [transition.to, document.id, project.id, actor.organizationId],
    );
    const reviewed = this.resultRow(updated.rows, 'Document review could not be recorded.');
    await this.pool.query(
      'INSERT INTO document_review_events (organization_id, project_id, document_id, action, comment, actor_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [
        actor.organizationId,
        project.id,
        document.id,
        input.action,
        input.comment?.trim() || null,
        actor.userId,
      ],
    );
    await this.audit(actor, `document.review_${input.action}`, 'document_revision', document.id, {
      projectId: project.id,
      documentNumber: document.document_number,
      revision: document.revision,
      comment: input.comment?.trim() || null,
    });
    return reviewed;
  }
  async createTransmittal(
    actor: AuthenticatedActor,
    projectId: string,
    input: CreateTransmittalInput,
  ) {
    this.requireRole(actor, [
      'organization_admin',
      'principal',
      'project_manager',
      'project_member',
    ]);
    const project = await this.projectForActor(actor, projectId);
    const documentIds = [...new Set(input.documentIds)];
    const documents = await this.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM document_revisions WHERE id = ANY($1::uuid[]) AND project_id = $2 AND organization_id = $3 AND status = 'issued'",
      [documentIds, project.id, actor.organizationId],
    );
    if (Number(documents.rows[0]?.count) !== documentIds.length)
      throw new BadRequestException('A transmittal can contain only issued project documents.');
    const result = await this.pool.query<TransmittalRow>(
      'INSERT INTO document_transmittals (organization_id, project_id, purpose, issue_note, recipients, document_ids, created_by) VALUES ($1,$2,$3,$4,$5,$6::uuid[],$7) RETURNING id, transmittal_number, purpose, issue_note, recipients, document_ids, created_at',
      [
        actor.organizationId,
        project.id,
        this.requiredText(input.purpose, 'Purpose'),
        input.issueNote?.trim() || null,
        input.recipients,
        documentIds,
        actor.userId,
      ],
    );
    const created = this.resultRow(result.rows, 'Transmittal could not be created.');
    await this.audit(actor, 'document.transmittal_created', 'document_transmittal', created.id, {
      projectId: project.id,
      documentCount: documentIds.length,
      recipientCount: input.recipients.length,
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
      'SELECT id, event_type, title, body, read_at, created_at FROM notifications WHERE organization_id = $1 AND user_id = $2 AND available_at <= NOW() ORDER BY created_at DESC LIMIT 50',
      [actor.organizationId, actor.userId],
    );
    return notifications.rows;
  }
  async getDocumentAnnotations(actor: AuthenticatedActor, projectId: string, documentId: string) {
    await this.documentForActor(actor, projectId, documentId);
    const annotations = await this.pool.query<DocumentAnnotationRow>(
      'SELECT id, page_number, x_percent, y_percent, body, created_by, created_at FROM document_annotations WHERE organization_id = $1 AND project_id = $2 AND document_id = $3 ORDER BY created_at ASC',
      [actor.organizationId, projectId, documentId],
    );
    return annotations.rows;
  }
  async createDocumentAnnotation(
    actor: AuthenticatedActor,
    projectId: string,
    documentId: string,
    input: CreateDocumentAnnotationInput,
  ) {
    await this.documentForActor(actor, projectId, documentId);
    if (
      (input.xPercent === undefined) !== (input.yPercent === undefined) ||
      (input.xPercent !== undefined && input.xPercent > 100) ||
      (input.yPercent !== undefined && input.yPercent > 100)
    )
      throw new BadRequestException('Drawing pins require x and y coordinates between 0 and 100.');
    const result = await this.pool.query<DocumentAnnotationRow>(
      'INSERT INTO document_annotations (organization_id, project_id, document_id, page_number, x_percent, y_percent, body, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, page_number, x_percent, y_percent, body, created_by, created_at',
      [
        actor.organizationId,
        projectId,
        documentId,
        input.pageNumber ?? 1,
        input.xPercent ?? null,
        input.yPercent ?? null,
        this.requiredText(input.body, 'Annotation'),
        actor.userId,
      ],
    );
    const annotation = this.resultRow(result.rows, 'Drawing annotation could not be saved.');
    await this.audit(actor, 'document.annotation_created', 'document_annotation', annotation.id, {
      projectId,
      documentId,
      pageNumber: annotation.page_number,
      hasPin: annotation.x_percent !== null,
    });
    return annotation;
  }
  async getNotificationPreferences(actor: AuthenticatedActor) {
    const preferences = await this.pool.query<NotificationPreferenceRow>(
      'SELECT event_type, in_app_enabled, email_enabled, quiet_hours_start::text, quiet_hours_end::text, digest_frequency, updated_at FROM notification_preferences WHERE organization_id = $1 AND user_id = $2 ORDER BY event_type',
      [actor.organizationId, actor.userId],
    );
    return preferences.rows;
  }
  async updateNotificationPreference(
    actor: AuthenticatedActor,
    input: UpdateNotificationPreferenceInput,
  ) {
    const eventType = this.requiredText(input.eventType, 'Event type');
    const quietHoursStart = input.quietHoursStart?.trim() || null;
    const quietHoursEnd = input.quietHoursEnd?.trim() || null;
    if (Boolean(quietHoursStart) !== Boolean(quietHoursEnd)) {
      throw new BadRequestException('Quiet hours require both a start and end time.');
    }
    if (quietHoursStart && quietHoursStart === quietHoursEnd) {
      throw new BadRequestException('Quiet-hours start and end must differ.');
    }
    const preference = await this.pool.query<NotificationPreferenceRow>(
      `INSERT INTO notification_preferences (
        organization_id, user_id, event_type, in_app_enabled, email_enabled,
        quiet_hours_start, quiet_hours_end, digest_frequency
      ) VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, $8)
      ON CONFLICT (organization_id, user_id, event_type) DO UPDATE SET
        in_app_enabled = EXCLUDED.in_app_enabled,
        email_enabled = EXCLUDED.email_enabled,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        digest_frequency = EXCLUDED.digest_frequency,
        updated_at = NOW()
      RETURNING event_type, in_app_enabled, email_enabled, quiet_hours_start::text,
        quiet_hours_end::text, digest_frequency, updated_at`,
      [
        actor.organizationId,
        actor.userId,
        eventType,
        input.inAppEnabled ?? true,
        input.emailEnabled ?? false,
        quietHoursStart,
        quietHoursEnd,
        input.digestFrequency ?? 'immediate',
      ],
    );
    const saved = this.resultRow(preference.rows, 'Notification preference could not be saved.');
    await this.audit(
      actor,
      'notification.preference_updated',
      'notification_preference',
      eventType,
      {
        eventType,
        inAppEnabled: saved.in_app_enabled,
        emailEnabled: saved.email_enabled,
        digestFrequency: saved.digest_frequency,
        quietHoursStart: saved.quiet_hours_start,
        quietHoursEnd: saved.quiet_hours_end,
      },
    );
    return saved;
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
  private async projectMembers(projectId: string, organizationId: string) {
    const members = await this.pool.query<ProjectMemberRow>(
      `SELECT pm.user_id, pm.role, p.display_name, p.title
       FROM project_members pm LEFT JOIN people p
         ON p.organization_id = $2 AND p.user_id = pm.user_id
       WHERE pm.project_id = $1 ORDER BY p.display_name NULLS LAST, pm.user_id`,
      [projectId, organizationId],
    );
    return members.rows;
  }
  private async documentForActor(actor: AuthenticatedActor, projectId: string, documentId: string) {
    await this.projectForActor(actor, projectId);
    const document = await this.pool.query<{ id: string }>(
      'SELECT id FROM document_revisions WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [documentId, projectId, actor.organizationId],
    );
    return this.resultRow(document.rows, 'Document is unavailable.');
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
  discipline?: string;
  building?: string;
  floor?: string;
  zone?: string;
  uploadId?: string;
}
export interface CreateDocumentAnnotationInput {
  body: string;
  pageNumber?: number;
  xPercent?: number;
  yPercent?: number;
}
export interface CreateTransmittalInput {
  purpose: string;
  issueNote?: string;
  recipients: string[];
  documentIds: string[];
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
