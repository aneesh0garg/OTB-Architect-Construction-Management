import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';

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

@Injectable()
export class AiService {
  constructor(
    private readonly pool: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
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
  intent: 'rfi_draft' | 'site_report' | 'meeting_minutes' | 'risk_summary';
  prompt: string;
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
