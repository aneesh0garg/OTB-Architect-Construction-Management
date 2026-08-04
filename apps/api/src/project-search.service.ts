import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';

interface SearchRow extends QueryResultRow {
  record_type: string;
  record_id: string;
  title: string;
  excerpt: string;
  occurred_at: Date;
}

@Injectable()
export class ProjectSearchService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async search(actor: AuthenticatedActor, projectId: string, query: string) {
    await this.projectAccess.requireAccess(actor, projectId);
    const terms = query
      .toLocaleLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2)
      .slice(0, 12)
      .map((term) => `%${term.replace(/[%_]/g, '')}%`);
    if (terms.length === 0)
      throw new BadRequestException('Use a search term with at least three letters.');
    const result = await this.database.query<SearchRow>(
      `SELECT record_type, record_id, title, excerpt, occurred_at FROM (
        SELECT 'document_revision' AS record_type, id::text AS record_id, document_number || ' · Rev ' || revision AS title, title AS excerpt, created_at AS occurred_at FROM document_revisions WHERE project_id = $1 AND (title ILIKE ANY($2::text[]) OR document_number ILIKE ANY($2::text[]))
        UNION ALL SELECT 'communication', id::text, subject, left(body, 500), filed_at FROM communications WHERE project_id = $1 AND filing_status = 'filed' AND (subject ILIKE ANY($2::text[]) OR body ILIKE ANY($2::text[]))
        UNION ALL SELECT 'task', id::text, title, coalesce(source_record_type, 'Task'), created_at FROM tasks WHERE project_id = $1 AND title ILIKE ANY($2::text[])
        UNION ALL SELECT 'workflow_record', id::text, record_type || ' #' || record_number::text || ' · ' || title, left(data::text, 500), created_at FROM workflow_records WHERE project_id = $1 AND (title ILIKE ANY($2::text[]) OR data::text ILIKE ANY($2::text[]))
        UNION ALL SELECT 'observation', id::text, 'Observation #' || observation_number::text || ' · ' || title, description, created_at FROM observations WHERE project_id = $1 AND (title ILIKE ANY($2::text[]) OR description ILIKE ANY($2::text[]))
      ) records ORDER BY occurred_at DESC LIMIT 50`,
      [projectId, terms],
    );
    await this.audit.record(actor, 'project.search_performed', 'project', projectId, {
      projectId,
      query,
      resultCount: result.rows.length,
    });
    return { query, results: result.rows };
  }
}
