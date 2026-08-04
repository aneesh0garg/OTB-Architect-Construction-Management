import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';

@Injectable()
export class ProjectExportService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async projectCsv(actor: AuthenticatedActor, projectId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
    const [tasks, documents, communications, observations, workflows] = await Promise.all([
      this.database.query<QueryResultRow>(
        "SELECT 'task' AS type, title, status, priority AS detail, due_date::text AS date FROM tasks WHERE project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'document' AS type, document_number || ' · Rev ' || revision AS title, status, document_type AS detail, issue_date::text AS date FROM document_revisions WHERE project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'communication' AS type, subject AS title, direction AS status, channel || ' · ' || sender AS detail, filed_at::date::text AS date FROM communications WHERE project_id = $1 AND filing_status = 'filed'",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'observation' AS type, 'Observation #' || observation_number::text || ' · ' || title AS title, status, priority AS detail, created_at::date::text AS date FROM observations WHERE project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT record_type AS type, '#' || record_number::text || ' · ' || title AS title, status, '' AS detail, created_at::date::text AS date FROM workflow_records WHERE project_id = $1",
        [projectId],
      ),
    ]);
    const rows = [
      ['Type', 'Title', 'Status', 'Detail', 'Date'],
      ...[
        ...tasks.rows,
        ...documents.rows,
        ...communications.rows,
        ...observations.rows,
        ...workflows.rows,
      ]
        .map((item) => [item.type, item.title, item.status, item.detail, item.date])
        .sort((left, right) => String(right[4]).localeCompare(String(left[4]))),
    ];
    await this.audit.record(actor, 'export.project_csv_created', 'project', projectId, {
      projectId,
      rowCount: rows.length - 1,
    });
    return csv(rows);
  }

  async commercialCsv(actor: AuthenticatedActor, projectId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
    const [phases, invoices, payments, budgets, commitments, changes] = await Promise.all([
      this.database.query<QueryResultRow>(
        "SELECT 'fee_phase' AS type, name AS reference, planned_fee::text AS amount, target_hours::text AS status FROM project_phases WHERE project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'invoice' AS type, invoice_number::text AS reference, total::text AS amount, status FROM invoices WHERE project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'payment' AS type, p.reference AS reference, p.amount::text AS amount, i.status FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'cost_budget' AS type, cost_code || ' · ' || name AS reference, amount::text AS amount, 'baseline' AS status FROM project_budgets WHERE project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'commitment' AS type, vendor_name || ' · ' || description AS reference, approved_amount::text AS amount, status FROM cost_commitments WHERE project_id = $1",
        [projectId],
      ),
      this.database.query<QueryResultRow>(
        "SELECT 'change_event' AS type, code || ' · ' || description AS reference, amount::text AS amount, status FROM cost_change_events WHERE project_id = $1",
        [projectId],
      ),
    ]);
    const rows = [
      ['Type', 'Reference', 'Amount (INR)', 'Status'],
      ...[
        ...phases.rows,
        ...invoices.rows,
        ...payments.rows,
        ...budgets.rows,
        ...commitments.rows,
        ...changes.rows,
      ].map((item) => [item.type, item.reference, item.amount, item.status]),
    ];
    await this.audit.record(actor, 'export.commercial_csv_created', 'project', projectId, {
      projectId,
      rowCount: rows.length - 1,
    });
    return csv(rows);
  }
}

const csv = (rows: unknown[][]) => `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
const cell = (value: unknown) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
