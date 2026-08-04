import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { AuditService } from './audit.service.js';

interface EvidenceRow extends QueryResultRow {
  source_type: string;
  source_id: string;
  title: string;
  excerpt: string;
  created_at: Date;
}
interface SettingRow extends QueryResultRow {
  enabled: boolean;
}
interface DraftRow extends QueryResultRow {
  id: string;
  intent: string;
  content: string;
  citations: EvidenceRow[];
  status: string;
  model: string;
}
interface FeedbackRow extends QueryResultRow {
  id: string;
  draft_id: string;
  rating: string;
  correction: string | null;
}

@Injectable()
export class AiService {
  constructor(
    private readonly pool: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
    private readonly auditTrail: AuditService,
  ) {}
  async setEnabled(actor: AuthenticatedActor, enabled: boolean) {
    if (!actor.roles.some((role) => ['organization_admin', 'principal'].includes(role)))
      throw new BadRequestException('Organization administrator permission is required.');
    await this.pool.query(
      'INSERT INTO organizations (id, name) VALUES ($1,$1) ON CONFLICT (id) DO NOTHING',
      [actor.organizationId],
    );
    const result = await this.pool.query<SettingRow>(
      'INSERT INTO ai_settings (organization_id, enabled, updated_by) VALUES ($1,$2,$3) ON CONFLICT (organization_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW() RETURNING enabled',
      [actor.organizationId, enabled, actor.userId],
    );
    await this.audit(actor, undefined, 'ai.settings_changed', { enabled });
    return row(result.rows, 'AI settings could not be updated.');
  }
  async search(actor: AuthenticatedActor, projectId: string, query: string) {
    await this.authorizeProject(actor, projectId);
    await this.requireEnabled(actor, projectId);
    const citations = await this.evidence(projectId, requiredText(query, 'Search query'));
    await this.audit(actor, projectId, 'ai.retrieval', { query, citationCount: citations.length });
    return {
      query,
      citations,
      notice: 'Citations include only retained project records you are permitted to access.',
    };
  }
  async createDraft(actor: AuthenticatedActor, projectId: string, input: CreateDraftInput) {
    await this.authorizeProject(actor, projectId);
    await this.requireEnabled(actor, projectId);
    const prompt = requiredText(input.prompt, 'Draft request');
    const citations = await this.evidence(projectId, prompt);
    const content = `Review-required ${input.intent} draft\n\nRequest: ${prompt}\n\nEvidence to verify before issuing:\n${citations.length ? citations.map((item, index) => `[${index + 1}] ${item.title}`).join('\n') : 'No matching retained project evidence was found.'}\n\nThis is not an issued project record. A permitted user must review, edit, and explicitly approve it.`;
    const result = await this.pool.query<DraftRow>(
      'INSERT INTO ai_drafts (organization_id, project_id, requested_by, intent, prompt, content, citations) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id, intent, content, citations, status, model',
      [
        actor.organizationId,
        projectId,
        actor.userId,
        input.intent,
        prompt,
        content,
        JSON.stringify(citations),
      ],
    );
    const draft = row(result.rows, 'AI draft could not be created.');
    await this.audit(actor, projectId, 'ai.draft_created', {
      draftId: draft.id,
      intent: input.intent,
      citationCount: citations.length,
    });
    return draft;
  }
  async approveDraft(actor: AuthenticatedActor, projectId: string, draftId: string) {
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<DraftRow>(
      'UPDATE ai_drafts SET status = $1 WHERE id = $2 AND project_id = $3 AND organization_id = $4 AND status = $5 RETURNING id, intent, content, citations, status, model',
      ['approved', draftId, projectId, actor.organizationId, 'review_required'],
    );
    const draft = row(result.rows, 'Draft is unavailable or already reviewed.');
    await this.audit(actor, projectId, 'ai.draft_approved', { draftId });
    return draft;
  }
  async rejectDraft(actor: AuthenticatedActor, projectId: string, draftId: string) {
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<DraftRow>(
      'UPDATE ai_drafts SET status = $1 WHERE id = $2 AND project_id = $3 AND organization_id = $4 AND status = $5 RETURNING id, intent, content, citations, status, model',
      ['rejected', draftId, projectId, actor.organizationId, 'review_required'],
    );
    const draft = row(result.rows, 'Draft is unavailable or already reviewed.');
    await this.audit(actor, projectId, 'ai.draft_rejected', { draftId });
    return draft;
  }
  async recordFeedback(
    actor: AuthenticatedActor,
    projectId: string,
    draftId: string,
    input: AiFeedbackInput,
  ) {
    await this.authorizeProject(actor, projectId);
    const draft = await this.pool.query<DraftRow>(
      'SELECT id, intent, content, citations, status, model FROM ai_drafts WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [draftId, projectId, actor.organizationId],
    );
    row(draft.rows, 'AI draft is unavailable.');
    const result = await this.pool.query<FeedbackRow>(
      `INSERT INTO ai_feedback (organization_id, project_id, draft_id, actor_id, rating, correction)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (draft_id, actor_id) DO UPDATE SET rating = EXCLUDED.rating, correction = EXCLUDED.correction, created_at = NOW()
       RETURNING id, draft_id, rating, correction`,
      [
        actor.organizationId,
        projectId,
        draftId,
        actor.userId,
        input.rating,
        input.correction?.trim() || null,
      ],
    );
    const feedback = row(result.rows, 'AI feedback could not be recorded.');
    await this.audit(actor, projectId, 'ai.feedback_recorded', {
      draftId,
      rating: feedback.rating,
      hasCorrection: Boolean(feedback.correction),
    });
    return feedback;
  }
  async exportRecords(actor: AuthenticatedActor) {
    this.requireAdmin(actor);
    const [settings, drafts, feedback, events] = await Promise.all([
      this.pool.query<SettingRow>('SELECT enabled FROM ai_settings WHERE organization_id = $1', [
        actor.organizationId,
      ]),
      this.pool.query<DraftRow>(
        `SELECT id, intent, content, citations, status, model
         FROM ai_drafts WHERE organization_id = $1 ORDER BY created_at`,
        [actor.organizationId],
      ),
      this.pool.query<QueryResultRow>(
        `SELECT id, project_id, draft_id, actor_id, rating, correction, created_at
         FROM ai_feedback WHERE organization_id = $1 ORDER BY created_at`,
        [actor.organizationId],
      ),
      this.pool.query<QueryResultRow>(
        `SELECT id, project_id, actor_id, action, metadata, created_at
         FROM ai_audit_events WHERE organization_id = $1 ORDER BY created_at`,
        [actor.organizationId],
      ),
    ]);
    await this.audit(actor, undefined, 'ai.records_exported', {
      draftCount: drafts.rows.length,
      feedbackCount: feedback.rows.length,
      eventCount: events.rows.length,
    });
    return {
      format: 'orbita-ai-records/v1',
      exportedAt: new Date().toISOString(),
      settings: settings.rows[0] ?? { enabled: false },
      drafts: drafts.rows,
      feedback: feedback.rows,
      events: events.rows,
    };
  }
  async deleteDraft(actor: AuthenticatedActor, projectId: string, draftId: string) {
    this.requireAdmin(actor);
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<DraftRow>(
      `DELETE FROM ai_drafts WHERE id = $1 AND project_id = $2 AND organization_id = $3
       RETURNING id, intent, content, citations, status, model`,
      [draftId, projectId, actor.organizationId],
    );
    const draft = row(result.rows, 'AI draft is unavailable.');
    await this.audit(actor, projectId, 'ai.draft_deleted', { draftId, intent: draft.intent });
    await this.auditTrail.record(actor, 'ai.draft_deleted', 'ai_draft', draftId, {
      projectId,
      intent: draft.intent,
    });
    return { id: draft.id, deleted: true };
  }
  private async evidence(projectId: string, query: string) {
    const terms = query
      .toLocaleLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2)
      .slice(0, 12)
      .map((term) => `%${term.replace(/[%_]/g, '')}%`);
    const result = await this.pool.query<EvidenceRow>(
      `SELECT source_type, source_id, title, excerpt, created_at FROM (
      SELECT 'document_revision' AS source_type, id::text AS source_id, document_number || ' · Rev ' || revision AS title, title AS excerpt, created_at FROM document_revisions WHERE project_id = $1 AND (title ILIKE ANY($2::text[]) OR document_number ILIKE ANY($2::text[]))
      UNION ALL SELECT 'communication', id::text, subject, left(body, 500), filed_at FROM communications WHERE project_id = $1 AND filing_status = 'filed' AND (subject ILIKE ANY($2::text[]) OR body ILIKE ANY($2::text[]))
      UNION ALL SELECT 'workflow_record', id::text, record_type || ' #' || record_number::text || ' · ' || title, left(data::text, 500), created_at FROM workflow_records WHERE project_id = $1 AND (title ILIKE ANY($2::text[]) OR data::text ILIKE ANY($2::text[]))
      UNION ALL SELECT 'observation', id::text, 'Observation #' || observation_number::text || ' · ' || title, description, created_at FROM observations WHERE project_id = $1 AND (title ILIKE ANY($2::text[]) OR description ILIKE ANY($2::text[]))
      UNION ALL SELECT 'task', id::text, title, status || ' · ' || priority, created_at FROM tasks WHERE project_id = $1 AND title ILIKE ANY($2::text[])
    ) project_evidence ORDER BY created_at DESC LIMIT 12`,
      [projectId, terms],
    );
    return result.rows;
  }
  private async requireEnabled(actor: AuthenticatedActor, projectId: string) {
    const result = await this.pool.query<SettingRow>(
      'SELECT enabled FROM ai_settings WHERE organization_id = $1',
      [actor.organizationId],
    );
    if (!result.rows[0]?.enabled)
      throw new BadRequestException('Project Brain is not enabled for this organization.');
    await this.audit(actor, projectId, 'ai.policy_checked', { enabled: true });
  }
  private requireAdmin(actor: AuthenticatedActor) {
    if (!actor.roles.some((role) => ['organization_admin', 'principal'].includes(role)))
      throw new BadRequestException('Organization administrator permission is required.');
  }
  private async authorizeProject(actor: AuthenticatedActor, projectId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
  }
  private async audit(
    actor: AuthenticatedActor,
    projectId: string | undefined,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    await this.pool.query(
      'INSERT INTO ai_audit_events (organization_id, project_id, actor_id, action, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)',
      [actor.organizationId, projectId ?? null, actor.userId, action, JSON.stringify(metadata)],
    );
  }
}
export interface CreateDraftInput {
  intent:
    | 'rfi_draft'
    | 'site_report'
    | 'meeting_minutes'
    | 'risk_summary'
    | 'submittal_review'
    | 'document_classification'
    | 'record_search';
  prompt: string;
}
export interface AiFeedbackInput {
  rating: 'correct' | 'incorrect' | 'incomplete' | 'unsafe' | 'not_useful';
  correction?: string;
}
const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
const requiredText = (value: string, label: string) => {
  const text = value?.trim();
  if (!text) throw new BadRequestException(`${label} is required.`);
  return text;
};
