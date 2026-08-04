import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';

interface Migration {
  id: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: '0001_phase_one_foundation',
    sql: `
      CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS teams (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (organization_id, name));
      CREATE TABLE IF NOT EXISTS projects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL REFERENCES organizations(id), code TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planning', location TEXT, stage TEXT NOT NULL DEFAULT 'planning', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (organization_id, code));
      CREATE TABLE IF NOT EXISTS project_members (project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id TEXT NOT NULL, role TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (project_id, user_id));
      CREATE TABLE IF NOT EXISTS audit_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', priority TEXT NOT NULL DEFAULT 'normal', due_date DATE, assignee_id TEXT, source_record_type TEXT, source_record_id TEXT, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS document_revisions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, document_number TEXT NOT NULL, document_type TEXT NOT NULL, title TEXT NOT NULL, revision TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', issue_date DATE, storage_key TEXT, issuer_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (project_id, document_number, revision));
      CREATE TABLE IF NOT EXISTS communications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, channel TEXT NOT NULL, direction TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, sender TEXT NOT NULL, recipients TEXT[] NOT NULL DEFAULT '{}', thread_id TEXT, source_message_id TEXT, filing_status TEXT NOT NULL DEFAULT 'filed', filed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, user_id TEXT NOT NULL, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, event_type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS field_visits (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, visit_date DATE NOT NULL, location TEXT NOT NULL, attendees TEXT[] NOT NULL DEFAULT '{}', weather TEXT, checklist JSONB NOT NULL DEFAULT '[]'::jsonb, notes TEXT, sync_state TEXT NOT NULL DEFAULT 'synced', client_capture_id TEXT, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (organization_id, client_capture_id));
      CREATE TABLE IF NOT EXISTS observations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, field_visit_id UUID REFERENCES field_visits(id) ON DELETE SET NULL, observation_number BIGSERIAL NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT, location TEXT, floor TEXT, zone TEXT, trade TEXT, priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open', evidence JSONB NOT NULL DEFAULT '[]'::jsonb, sync_state TEXT NOT NULL DEFAULT 'synced', client_capture_id TEXT, assignee_id TEXT, due_date DATE, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (organization_id, client_capture_id));
      CREATE TABLE IF NOT EXISTS workflow_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, record_type TEXT NOT NULL, record_number BIGSERIAL NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb, issued_at TIMESTAMPTZ, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS workflow_transitions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workflow_record_id UUID NOT NULL REFERENCES workflow_records(id) ON DELETE CASCADE, from_status TEXT, to_status TEXT NOT NULL, note TEXT, actor_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS project_phases (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name TEXT NOT NULL, planned_fee NUMERIC(14,2) NOT NULL DEFAULT 0, target_hours REAL NOT NULL DEFAULT 0, baseline_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (project_id, name, baseline_version));
      CREATE TABLE IF NOT EXISTS staff_allocations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL, staff_id TEXT NOT NULL, starts_on DATE NOT NULL, ends_on DATE NOT NULL, planned_hours REAL NOT NULL, billable BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS time_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL, task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, user_id TEXT NOT NULL, entry_date DATE NOT NULL, hours REAL NOT NULL, billable BOOLEAN NOT NULL DEFAULT true, note TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, invoice_number BIGSERIAL NOT NULL, client_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', issue_date DATE, due_date DATE, subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18, gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0, total NUMERIC(14,2) NOT NULL DEFAULT 0, accounting_sync_status TEXT NOT NULL DEFAULT 'not_connected', created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS invoice_lines (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, source_type TEXT NOT NULL, source_id TEXT, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_amount NUMERIC(14,2) NOT NULL, line_total NUMERIC(14,2) NOT NULL);
      CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, amount NUMERIC(14,2) NOT NULL, paid_date DATE NOT NULL, reference TEXT, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS ai_settings (organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE, enabled BOOLEAN NOT NULL DEFAULT false, updated_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS ai_drafts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, requested_by TEXT NOT NULL, intent TEXT NOT NULL, prompt TEXT NOT NULL, content TEXT NOT NULL, citations JSONB NOT NULL DEFAULT '[]'::jsonb, model TEXT NOT NULL DEFAULT 'local-cited-draft', status TEXT NOT NULL DEFAULT 'review_required', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS ai_audit_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID REFERENCES projects(id) ON DELETE SET NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS integration_connections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, provider TEXT NOT NULL, mailbox TEXT, scopes TEXT[] NOT NULL DEFAULT '{}', encrypted_refresh_token TEXT, status TEXT NOT NULL DEFAULT 'pending', connected_by TEXT NOT NULL, connected_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (organization_id, provider, mailbox));
      CREATE TABLE IF NOT EXISTS integration_oauth_states (id UUID PRIMARY KEY, organization_id TEXT NOT NULL, actor_id TEXT NOT NULL, provider TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    `,
  },
  {
    id: '0002_prevent_duplicate_filed_messages',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS communications_project_source_message_uniq
      ON communications (project_id, source_message_id)
      WHERE source_message_id IS NOT NULL;
    `,
  },
  {
    id: '0003_project_lifecycle_retention',
    sql: `
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;
    `,
  },
  {
    id: '0004_project_cost_controls',
    sql: `
      CREATE TABLE IF NOT EXISTS project_budgets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, cost_code TEXT NOT NULL, name TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL, baseline_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (project_id, cost_code, baseline_version));
      CREATE TABLE IF NOT EXISTS cost_commitments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, vendor_name TEXT NOT NULL, description TEXT NOT NULL, original_amount NUMERIC(14,2) NOT NULL, approved_amount NUMERIC(14,2) NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS cost_change_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, code TEXT NOT NULL, description TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (project_id, code));
    `,
  },
  {
    id: '0005_people_and_capacity',
    sql: `
      CREATE TABLE IF NOT EXISTS people (organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT NOT NULL, display_name TEXT NOT NULL, title TEXT, weekly_capacity_hours REAL NOT NULL DEFAULT 40, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (organization_id, user_id));
      CREATE TABLE IF NOT EXISTS team_members (team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (team_id, user_id));
    `,
  },
  {
    id: '0006_accounting_sync_fields',
    sql: `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accounting_external_id TEXT;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accounting_sync_error TEXT;
    `,
  },
  {
    id: '0007_controlled_document_uploads',
    sql: `
      CREATE TABLE IF NOT EXISTS document_uploads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, storage_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, content_type TEXT NOT NULL, expected_size BIGINT NOT NULL, actual_size BIGINT, status TEXT NOT NULL DEFAULT 'pending', expires_at TIMESTAMPTZ NOT NULL, uploaded_by TEXT NOT NULL, completed_at TIMESTAMPTZ, attached_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    `,
  },
];

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://orbita:orbita_local@localhost:5432/orbita',
  });
  private ready: Promise<void> | undefined;

  async onModuleInit() {
    this.ready ??= this.migrate();
    await this.ready;
  }

  async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
    await this.ready;
    return this.pool.query<T>(text, values);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private async migrate() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    );
    for (const migration of migrations) {
      const applied = await this.pool.query<{ id: string }>(
        'SELECT id FROM schema_migrations WHERE id = $1',
        [migration.id],
      );
      if (applied.rowCount) continue;
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }
}
