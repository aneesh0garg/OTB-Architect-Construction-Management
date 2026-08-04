import { BadRequestException, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { AuditService } from './audit.service.js';

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
export class FinanceService {
  constructor(
    private readonly pool: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

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
    const phase = row(result.rows, 'Phase could not be created.');
    await this.audit.record(actor, 'finance.phase_created', 'project_phase', phase.id, {
      projectId,
      plannedFee: phase.planned_fee,
      targetHours: phase.target_hours,
    });
    return phase;
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
    const allocation = row(result.rows, 'Allocation could not be created.');
    await this.audit.record(
      actor,
      'finance.allocation_created',
      'staff_allocation',
      allocation.id,
      {
        projectId,
        staffId: allocation.staff_id,
        plannedHours: allocation.planned_hours,
      },
    );
    return allocation;
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
    const entry = row(result.rows, 'Time entry could not be created.');
    await this.audit.record(actor, 'finance.time_created', 'time_entry', entry.id, {
      projectId,
      hours: entry.hours,
      entryDate: entry.entry_date,
    });
    return entry;
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
    const entry = row(result.rows, 'Time entry is unavailable or locked.');
    await this.audit.record(actor, 'finance.time_status_changed', 'time_entry', entry.id, {
      projectId,
      status: entry.status,
    });
    return entry;
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
    await this.audit.record(actor, 'finance.invoice_created', 'invoice', created.id, {
      projectId,
      invoiceNumber: created.invoice_number,
      total: created.total,
      lineCount: input.lines.length,
    });
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
    const invoice = row(result.rows, 'Invoice is unavailable.');
    await this.audit.record(actor, 'finance.invoice_status_changed', 'invoice', invoice.id, {
      projectId,
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
    });
    return invoice;
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
    const recorded = row(payment.rows, 'Payment could not be recorded.');
    await this.audit.record(actor, 'finance.payment_recorded', 'payment', recorded.id, {
      projectId,
      invoiceId: found.id,
      invoiceNumber: found.invoice_number,
      amount: recorded.amount,
      resultingInvoiceStatus: status,
    });
    return recorded;
  }
  private async authorizeProject(actor: AuthenticatedActor, projectId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
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
