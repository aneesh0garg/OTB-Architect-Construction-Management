import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';

interface PhaseRow extends QueryResultRow {
  id: string;
  name: string;
  planned_fee: string;
  target_hours: number;
  baseline_version: number;
}
interface AllocationRow extends QueryResultRow {
  id: string;
  staff_id: string;
  planned_hours: number;
  billable: boolean;
}
interface TimeRow extends QueryResultRow {
  id: string;
  hours: number;
  status: string;
  entry_date: string;
}
interface InvoiceRow extends QueryResultRow {
  id: string;
  invoice_number: number;
  status: string;
  subtotal: string;
  gst_amount: string;
  total: string;
  due_date: string | null;
  accounting_sync_status: string;
}
interface PaymentRow extends QueryResultRow {
  id: string;
  amount: string;
  paid_date: string;
  reference: string | null;
}

@Injectable()
export class FinanceService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://orbita:orbita_local@localhost:5432/orbita',
  });
  async onModuleInit() {
    await this.pool.query(`
    CREATE TABLE IF NOT EXISTS project_phases (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name TEXT NOT NULL, planned_fee NUMERIC(14,2) NOT NULL DEFAULT 0, target_hours REAL NOT NULL DEFAULT 0, baseline_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (project_id, name, baseline_version));
    CREATE TABLE IF NOT EXISTS staff_allocations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL, staff_id TEXT NOT NULL, starts_on DATE NOT NULL, ends_on DATE NOT NULL, planned_hours REAL NOT NULL, billable BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS time_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL, task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, user_id TEXT NOT NULL, entry_date DATE NOT NULL, hours REAL NOT NULL, billable BOOLEAN NOT NULL DEFAULT true, note TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, invoice_number BIGSERIAL NOT NULL, client_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', issue_date DATE, due_date DATE, subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18, gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0, total NUMERIC(14,2) NOT NULL DEFAULT 0, accounting_sync_status TEXT NOT NULL DEFAULT 'not_connected', created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS invoice_lines (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, source_type TEXT NOT NULL, source_id TEXT, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_amount NUMERIC(14,2) NOT NULL, line_total NUMERIC(14,2) NOT NULL);
    CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id TEXT NOT NULL, invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, amount NUMERIC(14,2) NOT NULL, paid_date DATE NOT NULL, reference TEXT, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  `);
  }
  async onModuleDestroy() {
    await this.pool.end();
  }

  async getControl(actor: AuthenticatedActor, projectId: string) {
    await this.authorizeProject(actor, projectId);
    const [phases, allocations, time, invoices, payments] = await Promise.all([
      this.pool.query<PhaseRow>(
        'SELECT id, name, planned_fee, target_hours, baseline_version FROM project_phases WHERE project_id = $1 ORDER BY created_at',
        [projectId],
      ),
      this.pool.query<AllocationRow>(
        'SELECT id, staff_id, planned_hours, billable FROM staff_allocations WHERE project_id = $1 ORDER BY starts_on',
        [projectId],
      ),
      this.pool.query<TimeRow>(
        'SELECT id, hours, status, entry_date FROM time_entries WHERE project_id = $1 ORDER BY entry_date DESC',
        [projectId],
      ),
      this.pool.query<InvoiceRow>(
        'SELECT id, invoice_number, status, subtotal, gst_amount, total, due_date, accounting_sync_status FROM invoices WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId],
      ),
      this.pool.query<PaymentRow>(
        'SELECT p.id, p.amount, p.paid_date, p.reference FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.project_id = $1 ORDER BY p.paid_date DESC',
        [projectId],
      ),
    ]);
    const plannedFee = phases.rows.reduce((sum, phase) => sum + Number(phase.planned_fee), 0);
    const targetHours = phases.rows.reduce((sum, phase) => sum + Number(phase.target_hours), 0);
    const loggedHours = time.rows.reduce((sum, entry) => sum + Number(entry.hours), 0);
    const invoiced = invoices.rows
      .filter((item) => !['draft', 'void'].includes(item.status))
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);
    const paid = payments.rows.reduce((sum, payment) => sum + Number(payment.amount), 0);
    return {
      phases: phases.rows,
      allocations: allocations.rows,
      time: time.rows,
      invoices: invoices.rows,
      payments: payments.rows,
      health: {
        plannedFee,
        targetHours,
        loggedHours,
        invoiced,
        paid,
        outstanding: invoiced - paid,
        feeBurn: plannedFee ? Math.round((invoiced / plannedFee) * 100) : 0,
        hoursBurn: targetHours ? Math.round((loggedHours / targetHours) * 100) : 0,
      },
    };
  }
  async createPhase(actor: AuthenticatedActor, projectId: string, input: CreatePhaseInput) {
    await this.requireManager(actor, projectId);
    const result = await this.pool.query<PhaseRow>(
      'INSERT INTO project_phases (organization_id, project_id, name, planned_fee, target_hours) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, planned_fee, target_hours, baseline_version',
      [
        actor.organizationId,
        projectId,
        requiredText(input.name, 'Phase name'),
        input.plannedFee,
        input.targetHours,
      ],
    );
    return row(result.rows, 'Phase could not be created.');
  }
  async createAllocation(
    actor: AuthenticatedActor,
    projectId: string,
    input: CreateAllocationInput,
  ) {
    await this.requireManager(actor, projectId);
    const result = await this.pool.query<AllocationRow>(
      'INSERT INTO staff_allocations (organization_id, project_id, phase_id, staff_id, starts_on, ends_on, planned_hours, billable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, staff_id, planned_hours, billable',
      [
        actor.organizationId,
        projectId,
        input.phaseId ?? null,
        requiredText(input.staffId, 'Staff member'),
        input.startsOn,
        input.endsOn,
        input.plannedHours,
        input.billable ?? true,
      ],
    );
    return row(result.rows, 'Allocation could not be created.');
  }
  async createTimeEntry(actor: AuthenticatedActor, projectId: string, input: CreateTimeInput) {
    await this.authorizeProject(actor, projectId);
    const result = await this.pool.query<TimeRow>(
      'INSERT INTO time_entries (organization_id, project_id, phase_id, task_id, user_id, entry_date, hours, billable, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, hours, status, entry_date',
      [
        actor.organizationId,
        projectId,
        input.phaseId ?? null,
        input.taskId ?? null,
        actor.userId,
        input.entryDate,
        input.hours,
        input.billable ?? true,
        input.note ?? null,
      ],
    );
    return row(result.rows, 'Time entry could not be created.');
  }
  async transitionTimeEntry(
    actor: AuthenticatedActor,
    projectId: string,
    entryId: string,
    status: string,
  ) {
    await this.requireManager(actor, projectId);
    const result = await this.pool.query<TimeRow>(
      'UPDATE time_entries SET status = $1 WHERE id = $2 AND project_id = $3 AND organization_id = $4 AND status <> $5 RETURNING id, hours, status, entry_date',
      [status, entryId, projectId, actor.organizationId, 'locked'],
    );
    return row(result.rows, 'Time entry is unavailable or locked.');
  }
  async createInvoice(actor: AuthenticatedActor, projectId: string, input: CreateInvoiceInput) {
    await this.requireFinance(actor, projectId);
    if (!input.lines.length)
      throw new BadRequestException('An invoice requires at least one source line.');
    const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
    const gstAmount = Number(((subtotal * (input.gstRate ?? 18)) / 100).toFixed(2));
    const invoice = await this.pool.query<InvoiceRow>(
      'INSERT INTO invoices (organization_id, project_id, client_name, issue_date, due_date, subtotal, gst_rate, gst_amount, total, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, invoice_number, status, subtotal, gst_amount, total, due_date, accounting_sync_status',
      [
        actor.organizationId,
        projectId,
        requiredText(input.clientName, 'Client name'),
        input.issueDate ?? null,
        input.dueDate ?? null,
        subtotal,
        input.gstRate ?? 18,
        gstAmount,
        subtotal + gstAmount,
        actor.userId,
      ],
    );
    const created = row(invoice.rows, 'Invoice could not be created.');
    for (const line of input.lines)
      await this.pool.query(
        'INSERT INTO invoice_lines (invoice_id, source_type, source_id, description, quantity, unit_amount, line_total) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          created.id,
          line.sourceType,
          line.sourceId ?? null,
          requiredText(line.description, 'Line description'),
          line.quantity,
          line.unitAmount,
          line.quantity * line.unitAmount,
        ],
      );
    return created;
  }
  async transitionInvoice(
    actor: AuthenticatedActor,
    projectId: string,
    invoiceId: string,
    status: string,
  ) {
    await this.requireFinance(actor, projectId);
    const valid = [
      'draft',
      'internal_review',
      'issued',
      'partially_paid',
      'paid',
      'overdue',
      'void',
      'written_off',
    ];
    if (!valid.includes(status)) throw new BadRequestException('Invalid invoice status.');
    const result = await this.pool.query<InvoiceRow>(
      'UPDATE invoices SET status = $1 WHERE id = $2 AND project_id = $3 AND organization_id = $4 RETURNING id, invoice_number, status, subtotal, gst_amount, total, due_date, accounting_sync_status',
      [status, invoiceId, projectId, actor.organizationId],
    );
    return row(result.rows, 'Invoice is unavailable.');
  }
  async recordPayment(
    actor: AuthenticatedActor,
    projectId: string,
    invoiceId: string,
    input: CreatePaymentInput,
  ) {
    await this.requireFinance(actor, projectId);
    const invoice = await this.pool.query<InvoiceRow>(
      'SELECT id, invoice_number, status, subtotal, gst_amount, total, due_date, accounting_sync_status FROM invoices WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [invoiceId, projectId, actor.organizationId],
    );
    const found = row(invoice.rows, 'Invoice is unavailable.');
    const payment = await this.pool.query<PaymentRow>(
      'INSERT INTO payments (organization_id, invoice_id, amount, paid_date, reference, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, amount, paid_date, reference',
      [
        actor.organizationId,
        found.id,
        input.amount,
        input.paidDate,
        input.reference ?? null,
        actor.userId,
      ],
    );
    const totalPaid = await this.pool.query<{ paid: string }>(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1',
      [found.id],
    );
    const status =
      Number(totalPaid.rows[0]?.paid ?? 0) >= Number(found.total) ? 'paid' : 'partially_paid';
    await this.pool.query('UPDATE invoices SET status = $1 WHERE id = $2', [status, found.id]);
    return row(payment.rows, 'Payment could not be recorded.');
  }
  private async authorizeProject(actor: AuthenticatedActor, projectId: string) {
    const project = await this.pool.query<QueryResultRow>(
      'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
      [projectId, actor.organizationId],
    );
    if (!project.rows[0])
      throw new BadRequestException('Project is unavailable in this organization.');
  }
  private async requireManager(actor: AuthenticatedActor, projectId: string) {
    await this.authorizeProject(actor, projectId);
    if (
      !actor.roles.some((role) =>
        ['organization_admin', 'principal', 'project_manager'].includes(role),
      )
    )
      throw new BadRequestException('Project manager permission is required.');
  }
  private async requireFinance(actor: AuthenticatedActor, projectId: string) {
    await this.authorizeProject(actor, projectId);
    if (
      !actor.roles.some((role) =>
        ['organization_admin', 'principal', 'finance_admin'].includes(role),
      )
    )
      throw new BadRequestException('Finance permission is required.');
  }
}
export interface CreatePhaseInput {
  name: string;
  plannedFee: number;
  targetHours: number;
}
export interface CreateAllocationInput {
  phaseId?: string;
  staffId: string;
  startsOn: string;
  endsOn: string;
  plannedHours: number;
  billable?: boolean;
}
export interface CreateTimeInput {
  phaseId?: string;
  taskId?: string;
  entryDate: string;
  hours: number;
  billable?: boolean;
  note?: string;
}
export interface CreateInvoiceInput {
  clientName: string;
  issueDate?: string;
  dueDate?: string;
  gstRate?: number;
  lines: {
    sourceType: string;
    sourceId?: string;
    description: string;
    quantity: number;
    unitAmount: number;
  }[];
}
export interface CreatePaymentInput {
  amount: number;
  paidDate: string;
  reference?: string;
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
