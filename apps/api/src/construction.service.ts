import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';

type WorkflowType = 'rfi' | 'submittal' | 'site_instruction' | 'meeting_minutes' | 'decision';
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
    return row(result.rows, 'Field visit could not be created.');
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
    return row(result.rows, 'Observation could not be created.');
  }
  async createWorkflowRecord(
    actor: AuthenticatedActor,
    projectId: string,
    input: CreateWorkflowInput,
  ) {
    await this.authorizeProject(actor, projectId);
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
    return next;
  }
  private async authorizeProject(actor: AuthenticatedActor, projectId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
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
  type === 'rfi' || type === 'site_instruction' || type === 'meeting_minutes'
    ? 'issued'
    : 'submitted';
const validTransition = (type: WorkflowType, current: string, next: string) => {
  const states = workflowStates[type];
  if (!states.includes(next) || current === 'closed' || current === 'archived') return false;
  if (next === 'reopened') return ['answered', 'closed'].includes(current);
  return states.indexOf(next) >= states.indexOf(current) && next !== current;
};
