import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { AuditService } from './audit.service.js';
import { NotificationService } from './notification.service.js';

type WorkflowType =
  'rfi' | 'submittal' | 'site_instruction' | 'meeting_minutes' | 'site_visit_report' | 'decision';
interface FieldVisitRow extends QueryResultRow {
  id: string;
  visit_date: string;
  location: string;
  sync_state: string;
}
interface ObservationRow extends QueryResultRow {
  id: string;
  observation_number: number;
  title: string;
  priority: string;
  status: string;
  sync_state: string;
}
interface ObservationDetailRow extends ObservationRow {
  description: string;
  category: string | null;
  location: string | null;
  floor: string | null;
  zone: string | null;
  trade: string | null;
  evidence: unknown[];
  assignee_id: string | null;
  due_date: string | null;
  created_at: Date;
}
interface ObservationCommentRow extends QueryResultRow {
  id: string;
  body: string;
  created_by: string;
  created_at: Date;
}
interface WorkflowRow extends QueryResultRow {
  id: string;
  record_type: WorkflowType;
  record_number: number;
  title: string;
  status: string;
  data: Record<string, unknown>;
  issued_at: Date | null;
}

@Injectable()
export class ConstructionService {
  constructor(
    private readonly pool: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async getRegister(actor: AuthenticatedActor, projectId: string) {
    await this.authorizeProject(actor, projectId);
    const [visits, observations, workflows] = await Promise.all([
      this.pool.query<FieldVisitRow>(
        'SELECT id, visit_date, location, sync_state FROM field_visits WHERE project_id = $1 ORDER BY visit_date DESC',
        [projectId],
      ),
      this.pool.query<ObservationRow>(
        'SELECT id, observation_number, title, priority, status, sync_state FROM observations WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId],
      ),
      this.pool.query<WorkflowRow>(
        'SELECT id, record_type, record_number, title, status, data, issued_at FROM workflow_records WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId],
      ),
    ]);
    return { visits: visits.rows, observations: observations.rows, workflows: workflows.rows };
  }
  async createFieldVisit(
    actor: AuthenticatedActor,
    projectId: string,
    input: CreateFieldVisitInput,
  ) {
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<FieldVisitRow>(
      'INSERT INTO field_visits (organization_id, project_id, visit_date, location, attendees, weather, checklist, notes, sync_state, client_capture_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11) ON CONFLICT (organization_id, client_capture_id) DO UPDATE SET sync_state = EXCLUDED.sync_state RETURNING id, visit_date, location, sync_state',
      [
        actor.organizationId,
        projectId,
        input.visitDate,
        requiredText(input.location, 'Site location'),
        input.attendees ?? [],
        input.weather ?? null,
        JSON.stringify(input.checklist ?? []),
        input.notes ?? null,
        input.syncState ?? 'synced',
        input.clientCaptureId ?? null,
        actor.userId,
      ],
    );
    const visit = row(result.rows, 'Field visit could not be created.');
    await this.audit.record(actor, 'field_visit.captured', 'field_visit', visit.id, {
      projectId,
      syncState: visit.sync_state,
    });
    return visit;
  }
  async createObservation(
    actor: AuthenticatedActor,
    projectId: string,
    input: CreateObservationInput,
  ) {
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<ObservationRow>(
      'INSERT INTO observations (organization_id, project_id, field_visit_id, title, description, category, location, floor, zone, trade, priority, evidence, sync_state, client_capture_id, assignee_id, due_date, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17) ON CONFLICT (organization_id, client_capture_id) DO UPDATE SET sync_state = EXCLUDED.sync_state RETURNING id, observation_number, title, priority, status, sync_state',
      [
        actor.organizationId,
        projectId,
        input.fieldVisitId ?? null,
        requiredText(input.title, 'Observation title'),
        input.description ?? '',
        input.category ?? null,
        input.location ?? null,
        input.floor ?? null,
        input.zone ?? null,
        input.trade ?? null,
        input.priority ?? 'normal',
        JSON.stringify(input.evidence ?? []),
        input.syncState ?? 'synced',
        input.clientCaptureId ?? null,
        input.assigneeId ?? null,
        input.dueDate ?? null,
        actor.userId,
      ],
    );
    const observation = row(result.rows, 'Observation could not be created.');
    await this.audit.record(actor, 'observation.captured', 'observation', observation.id, {
      projectId,
      priority: observation.priority,
      syncState: observation.sync_state,
    });
    return observation;
  }
  async getObservationComments(
    actor: AuthenticatedActor,
    projectId: string,
    observationId: string,
  ) {
    await this.observationForActor(actor, projectId, observationId);
    const comments = await this.pool.query<ObservationCommentRow>(
      'SELECT id, body, created_by, created_at FROM observation_comments WHERE organization_id = $1 AND project_id = $2 AND observation_id = $3 ORDER BY created_at ASC',
      [actor.organizationId, projectId, observationId],
    );
    return comments.rows;
  }
  async getObservation(actor: AuthenticatedActor, projectId: string, observationId: string) {
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<ObservationDetailRow>(
      'SELECT id, observation_number, title, description, category, location, floor, zone, trade, priority, status, evidence, sync_state, assignee_id, due_date, created_at FROM observations WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [observationId, projectId, actor.organizationId],
    );
    return row(result.rows, 'Observation is unavailable.');
  }
  async addObservationComment(
    actor: AuthenticatedActor,
    projectId: string,
    observationId: string,
    input: CreateObservationCommentInput,
  ) {
    await this.observationForActor(actor, projectId, observationId);
    const result = await this.pool.query<ObservationCommentRow>(
      `INSERT INTO observation_comments (
        organization_id, project_id, observation_id, body, client_comment_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (organization_id, client_comment_id) DO UPDATE SET body = EXCLUDED.body
      RETURNING id, body, created_by, created_at`,
      [
        actor.organizationId,
        projectId,
        observationId,
        requiredText(input.body, 'Comment'),
        input.clientCommentId ?? null,
        actor.userId,
      ],
    );
    const comment = row(result.rows, 'Comment could not be saved.');
    await this.audit.record(actor, 'observation.comment_added', 'observation_comment', comment.id, {
      projectId,
      observationId,
    });
    await this.notifications.notifyProject(
      actor,
      projectId,
      'observation.comment_added',
      'New observation comment',
      `A comment was added to observation ${observationId.slice(0, 8)}.`,
    );
    return comment;
  }
  async createWorkflowRecord(
    actor: AuthenticatedActor,
    projectId: string,
    input: CreateWorkflowInput,
  ) {
    await this.authorizeProject(actor, projectId);
    if (input.recordType === 'site_visit_report')
      await this.assertSiteVisitReportSources(actor, projectId, input.data);
    await this.assertOptionalObservationSource(actor, projectId, input.data);
    const status = workflowStates[input.recordType][0];
    const result = await this.pool.query<WorkflowRow>(
      'INSERT INTO workflow_records (organization_id, project_id, record_type, title, status, data, created_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id, record_type, record_number, title, status, data, issued_at',
      [
        actor.organizationId,
        projectId,
        input.recordType,
        requiredText(input.title, 'Record title'),
        status,
        JSON.stringify(input.data ?? {}),
        actor.userId,
      ],
    );
    const created = row(result.rows, 'Workflow record could not be created.');
    await this.pool.query(
      'INSERT INTO workflow_transitions (workflow_record_id, to_status, note, actor_id) VALUES ($1,$2,$3,$4)',
      [created.id, status, 'Record created', actor.userId],
    );
    await this.audit.record(actor, 'workflow.created', 'workflow_record', created.id, {
      projectId,
      recordType: created.record_type,
      status: created.status,
    });
    return created;
  }
  async transitionWorkflowRecord(
    actor: AuthenticatedActor,
    projectId: string,
    recordId: string,
    input: TransitionInput,
  ) {
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<WorkflowRow>(
      'SELECT id, record_type, record_number, title, status, data, issued_at FROM workflow_records WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [recordId, projectId, actor.organizationId],
    );
    const current = row(result.rows, 'Workflow record is unavailable.');
    if (!validTransition(current.record_type, current.status, input.status))
      throw new BadRequestException(
        `Invalid ${current.record_type} transition from ${current.status} to ${input.status}.`,
      );
    const updated = await this.pool.query<WorkflowRow>(
      'UPDATE workflow_records SET status = $1, issued_at = CASE WHEN $1 = $2 AND issued_at IS NULL THEN NOW() ELSE issued_at END WHERE id = $3 RETURNING id, record_type, record_number, title, status, data, issued_at',
      [input.status, issuedStatus(current.record_type), current.id],
    );
    const next = row(updated.rows, 'Workflow record could not be updated.');
    await this.pool.query(
      'INSERT INTO workflow_transitions (workflow_record_id, from_status, to_status, note, actor_id) VALUES ($1,$2,$3,$4,$5)',
      [current.id, current.status, input.status, input.note ?? null, actor.userId],
    );
    await this.audit.record(actor, 'workflow.transitioned', 'workflow_record', next.id, {
      projectId,
      recordType: next.record_type,
      fromStatus: current.status,
      toStatus: next.status,
    });
    if (next.status === issuedStatus(next.record_type)) {
      await this.notifications.notifyProject(
        actor,
        projectId,
        'workflow.issued',
        `${next.record_type.replaceAll('_', ' ')} #${next.record_number} issued`,
        next.title,
      );
    }
    return next;
  }
  private async authorizeProject(actor: AuthenticatedActor, projectId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
  }
  private async observationForActor(
    actor: AuthenticatedActor,
    projectId: string,
    observationId: string,
  ) {
    await this.authorizeProject(actor, projectId);
    const observation = await this.pool.query<{ id: string }>(
      'SELECT id FROM observations WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [observationId, projectId, actor.organizationId],
    );
    return row(observation.rows, 'Observation is unavailable.');
  }
  private async assertSiteVisitReportSources(
    actor: AuthenticatedActor,
    projectId: string,
    data: Record<string, unknown> | undefined,
  ) {
    const fieldVisitId = data?.fieldVisitId;
    const observationIds = data?.observationIds;
    if (
      typeof fieldVisitId !== 'string' ||
      !isUuid(fieldVisitId) ||
      !Array.isArray(observationIds) ||
      observationIds.length === 0 ||
      !observationIds.every((id): id is string => typeof id === 'string' && isUuid(id))
    ) {
      throw new BadRequestException(
        'A site visit report requires one field visit and at least one selected observation.',
      );
    }
    const visit = await this.pool.query(
      'SELECT id FROM field_visits WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [fieldVisitId, projectId, actor.organizationId],
    );
    if (!visit.rows[0]) throw new BadRequestException('The selected field visit is unavailable.');
    const observations = await this.pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM observations WHERE id = ANY($1::uuid[]) AND project_id = $2 AND organization_id = $3',
      [observationIds, projectId, actor.organizationId],
    );
    if (Number(observations.rows[0]?.count) !== new Set(observationIds).size)
      throw new BadRequestException('One or more selected observations are unavailable.');
  }
  private async assertOptionalObservationSource(
    actor: AuthenticatedActor,
    projectId: string,
    data: Record<string, unknown> | undefined,
  ) {
    const sourceObservationId = data?.sourceObservationId;
    if (sourceObservationId === undefined) return;
    if (typeof sourceObservationId !== 'string' || !isUuid(sourceObservationId))
      throw new BadRequestException('The source observation reference is invalid.');
    const observation = await this.pool.query(
      'SELECT id FROM observations WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [sourceObservationId, projectId, actor.organizationId],
    );
    if (!observation.rows[0])
      throw new BadRequestException('The source observation is unavailable.');
  }
}
export interface CreateFieldVisitInput {
  visitDate: string;
  location: string;
  attendees?: string[];
  weather?: string;
  checklist?: unknown[];
  notes?: string;
  syncState?: string;
  clientCaptureId?: string;
}
export interface CreateObservationInput {
  fieldVisitId?: string;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  floor?: string;
  zone?: string;
  trade?: string;
  priority?: string;
  evidence?: unknown[];
  syncState?: string;
  clientCaptureId?: string;
  assigneeId?: string;
  dueDate?: string;
}
export interface CreateObservationCommentInput {
  body: string;
  clientCommentId?: string;
}
export interface CreateWorkflowInput {
  recordType: WorkflowType;
  title: string;
  data?: Record<string, unknown>;
}
export interface TransitionInput {
  status: string;
  note?: string;
}
const workflowStates: Record<WorkflowType, string[]> = {
  rfi: ['draft', 'issued', 'answered', 'closed', 'returned', 'reopened'],
  submittal: [
    'draft',
    'submitted',
    'under_review',
    'revise_resubmit',
    'approved',
    'approved_as_noted',
    'rejected',
    'closed',
  ],
  site_instruction: ['draft', 'issued', 'acknowledged', 'completed', 'verified', 'closed'],
  meeting_minutes: ['draft', 'internal_review', 'issued', 'superseded', 'archived'],
  site_visit_report: ['draft', 'internal_review', 'issued', 'acknowledged', 'archived'],
  decision: ['draft', 'pending_approval', 'decided', 'closed'],
};
const requiredText = (value: string, label: string) => {
  const text = value?.trim();
  if (!text) throw new BadRequestException(`${label} is required.`);
  return text;
};
const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
const issuedStatus = (type: WorkflowType) =>
  type === 'rfi' ||
  type === 'site_instruction' ||
  type === 'meeting_minutes' ||
  type === 'site_visit_report'
    ? 'issued'
    : 'submitted';
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validTransition = (type: WorkflowType, current: string, next: string) => {
  if (type === 'site_visit_report') {
    const reportTransitions: Record<string, string[]> = {
      draft: ['internal_review'],
      internal_review: ['issued', 'archived'],
      issued: ['acknowledged', 'archived'],
      acknowledged: ['archived'],
      archived: [],
    };
    return reportTransitions[current]?.includes(next) ?? false;
  }
  const states = workflowStates[type];
  if (!states.includes(next) || current === 'closed' || current === 'archived') return false;
  if (next === 'reopened') return ['answered', 'closed'].includes(current);
  return states.indexOf(next) >= states.indexOf(current) && next !== current;
};
