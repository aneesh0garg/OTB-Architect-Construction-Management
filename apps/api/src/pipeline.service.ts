import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedActor, PlatformRole } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';

interface OpportunityRow extends QueryResultRow {
  id: string;
  client_name: string;
  project_name: string;
  project_type: string | null;
  stage: string;
  status: string;
  probability: number;
  anticipated_fee: string;
  target_start_date: string | null;
  target_end_date: string | null;
  next_action: string | null;
  converted_project_id: string | null;
  created_at: Date;
  updated_at: Date;
}
interface ProposalRow extends QueryResultRow {
  id: string;
  opportunity_id: string;
  version: number;
  status: string;
  scope: string;
  assumptions: string;
  exclusions: string;
  fee: string;
  initial_staffing: InitialStaffing[];
  created_at: Date;
}
interface PhaseRow extends QueryResultRow {
  id: string;
  proposal_id: string;
  name: string;
  planned_fee: string;
  target_hours: number;
  position: number;
}
interface ProjectRow extends QueryResultRow {
  id: string;
  code: string;
  name: string;
  client_name: string | null;
  status: string;
  stage: string;
}

@Injectable()
export class PipelineService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthenticatedActor) {
    const opportunities = await this.database.query<OpportunityRow>(
      `SELECT id, client_name, project_name, project_type, stage, status, probability,
        anticipated_fee, target_start_date, target_end_date, next_action, converted_project_id,
        created_at, updated_at
       FROM opportunities WHERE organization_id = $1 ORDER BY updated_at DESC`,
      [actor.organizationId],
    );
    const proposals = await this.database.query<ProposalRow>(
      `SELECT id, opportunity_id, version, status, scope, assumptions, exclusions, fee,
        initial_staffing, created_at FROM proposals WHERE organization_id = $1
       ORDER BY opportunity_id, version DESC`,
      [actor.organizationId],
    );
    const phases = await this.database.query<PhaseRow>(
      `SELECT pp.id, pp.proposal_id, pp.name, pp.planned_fee, pp.target_hours, pp.position
       FROM proposal_phases pp JOIN proposals p ON p.id = pp.proposal_id
       WHERE p.organization_id = $1 ORDER BY pp.position`,
      [actor.organizationId],
    );
    return {
      opportunities: opportunities.rows.map((opportunity) => ({
        ...opportunity,
        proposals: proposals.rows
          .filter((proposal) => proposal.opportunity_id === opportunity.id)
          .map((proposal) => ({
            ...proposal,
            phases: phases.rows.filter((phase) => proposal.id === phase.proposal_id),
          })),
      })),
    };
  }

  async createOpportunity(actor: AuthenticatedActor, input: CreateOpportunityInput) {
    this.requireManager(actor);
    const result = await this.database.query<OpportunityRow>(
      `INSERT INTO opportunities (organization_id, client_name, project_name, project_type, stage,
        probability, anticipated_fee, target_start_date, target_end_date, next_action, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, client_name, project_name, project_type, stage, status, probability,
        anticipated_fee, target_start_date, target_end_date, next_action, converted_project_id,
        created_at, updated_at`,
      [
        actor.organizationId,
        requiredText(input.clientName, 'Client name'),
        requiredText(input.projectName, 'Project name'),
        optionalText(input.projectType),
        input.stage ?? 'lead',
        probability(input.probability ?? 0),
        nonNegative(input.anticipatedFee ?? 0, 'Anticipated fee'),
        input.targetStartDate ?? null,
        input.targetEndDate ?? null,
        optionalText(input.nextAction),
        actor.userId,
      ],
    );
    const opportunity = row(result.rows, 'Opportunity could not be created.');
    await this.audit.record(actor, 'pipeline.opportunity_created', 'opportunity', opportunity.id, {
      clientName: opportunity.client_name,
      anticipatedFee: opportunity.anticipated_fee,
      stage: opportunity.stage,
    });
    return opportunity;
  }

  async createProposal(
    actor: AuthenticatedActor,
    opportunityId: string,
    input: CreateProposalInput,
  ) {
    this.requireManager(actor);
    const staffing = normalizeStaffing(input.initialStaffing ?? []);
    const proposal = await this.database.transaction<ProposalRow>(async (client) => {
      const opportunity = await client.query<OpportunityRow>(
        'SELECT id, client_name, project_name, project_type, stage, status, probability, anticipated_fee, target_start_date, target_end_date, next_action, converted_project_id, created_at, updated_at FROM opportunities WHERE id = $1 AND organization_id = $2 FOR UPDATE',
        [opportunityId, actor.organizationId],
      );
      if (!opportunity.rows[0] || opportunity.rows[0].status !== 'open')
        throw new BadRequestException('Opportunity is unavailable for proposal work.');
      const version = await client.query<{ version: number }>(
        'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM proposals WHERE opportunity_id = $1',
        [opportunityId],
      );
      const created = await client.query<ProposalRow>(
        `INSERT INTO proposals (organization_id, opportunity_id, version, scope, assumptions,
          exclusions, fee, initial_staffing, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
         RETURNING id, opportunity_id, version, status, scope, assumptions, exclusions, fee,
          initial_staffing, created_at`,
        [
          actor.organizationId,
          opportunityId,
          version.rows[0]!.version,
          requiredText(input.scope, 'Proposal scope'),
          input.assumptions?.trim() ?? '',
          input.exclusions?.trim() ?? '',
          nonNegative(input.fee, 'Proposal fee'),
          JSON.stringify(staffing),
          actor.userId,
        ],
      );
      const value = row(created.rows, 'Proposal could not be created.');
      for (const [position, phase] of input.phases.entries()) {
        await client.query(
          'INSERT INTO proposal_phases (proposal_id, name, planned_fee, target_hours, position) VALUES ($1,$2,$3,$4,$5)',
          [
            value.id,
            requiredText(phase.name, 'Proposal phase name'),
            nonNegative(phase.plannedFee, 'Phase planned fee'),
            nonNegative(phase.targetHours, 'Phase target hours'),
            position,
          ],
        );
      }
      return value;
    });
    await this.audit.record(actor, 'pipeline.proposal_created', 'proposal', proposal.id, {
      opportunityId,
      version: proposal.version,
      fee: proposal.fee,
    });
    return proposal;
  }

  async convertToProject(
    actor: AuthenticatedActor,
    opportunityId: string,
    input: ConvertOpportunityInput,
  ) {
    this.requireManager(actor);
    const project = await this.database.transaction<ProjectRow>(async (client) => {
      const opportunity = await client.query<OpportunityRow>(
        'SELECT id, client_name, project_name, project_type, stage, status, probability, anticipated_fee, target_start_date, target_end_date, next_action, converted_project_id, created_at, updated_at FROM opportunities WHERE id = $1 AND organization_id = $2 FOR UPDATE',
        [opportunityId, actor.organizationId],
      );
      const current = opportunity.rows[0];
      if (!current || current.status !== 'open')
        throw new BadRequestException('Opportunity is unavailable for conversion.');
      const proposal = await client.query<ProposalRow>(
        `SELECT id, opportunity_id, version, status, scope, assumptions, exclusions, fee,
          initial_staffing, created_at FROM proposals
         WHERE id = $1 AND opportunity_id = $2 AND organization_id = $3 FOR UPDATE`,
        [input.proposalId, opportunityId, actor.organizationId],
      );
      const accepted = proposal.rows[0];
      if (!accepted) throw new BadRequestException('Choose a proposal for this opportunity.');
      const phases = await client.query<PhaseRow>(
        'SELECT id, proposal_id, name, planned_fee, target_hours, position FROM proposal_phases WHERE proposal_id = $1 ORDER BY position',
        [accepted.id],
      );
      if (!phases.rows.length)
        throw new BadRequestException('A proposal needs at least one phase.');
      const created = await client.query<ProjectRow>(
        `INSERT INTO projects (organization_id, code, name, client_name, location, stage)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, code, name, client_name, status, stage`,
        [
          actor.organizationId,
          requiredText(input.projectCode, 'Project code').toUpperCase(),
          current.project_name,
          current.client_name,
          optionalText(input.location),
          input.stage ?? 'pursuit',
        ],
      );
      const project = row(created.rows, 'Project could not be created.');
      const projectRole: PlatformRole = actor.roles.includes('project_manager')
        ? 'project_manager'
        : (actor.roles[0] ?? 'project_member');
      await client.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3)',
        [project.id, actor.userId, projectRole],
      );
      for (const phase of phases.rows) {
        const inserted = await client.query<{ id: string }>(
          'INSERT INTO project_phases (organization_id, project_id, name, planned_fee, target_hours) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [actor.organizationId, project.id, phase.name, phase.planned_fee, phase.target_hours],
        );
        for (const allocation of accepted.initial_staffing) {
          await client.query(
            `INSERT INTO staff_allocations (organization_id, project_id, phase_id, staff_id, starts_on,
              ends_on, planned_hours, billable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              actor.organizationId,
              project.id,
              inserted.rows[0]!.id,
              allocation.staffId,
              allocation.startsOn,
              allocation.endsOn,
              allocation.plannedHours / phases.rows.length,
              allocation.billable ?? true,
            ],
          );
        }
      }
      await client.query('UPDATE proposals SET status = $1, updated_at = NOW() WHERE id = $2', [
        'accepted',
        accepted.id,
      ]);
      await client.query(
        'UPDATE opportunities SET status = $1, stage = $2, converted_project_id = $3, updated_at = NOW() WHERE id = $4',
        ['won', 'won', project.id, opportunityId],
      );
      return project;
    });
    await this.audit.record(actor, 'pipeline.opportunity_converted', 'opportunity', opportunityId, {
      proposalId: input.proposalId,
      projectId: project.id,
      projectCode: project.code,
    });
    return project;
  }

  private requireManager(actor: AuthenticatedActor) {
    if (
      !actor.roles.some((role) =>
        ['organization_admin', 'principal', 'project_manager'].includes(role),
      )
    )
      throw new BadRequestException('Pipeline manager permission is required.');
  }
}

export interface CreateOpportunityInput {
  clientName: string;
  projectName: string;
  projectType?: string;
  stage?: 'lead' | 'qualified' | 'proposal' | 'negotiation';
  probability?: number;
  anticipatedFee?: number;
  targetStartDate?: string;
  targetEndDate?: string;
  nextAction?: string;
}
export interface ProposalPhaseInput {
  name: string;
  plannedFee: number;
  targetHours: number;
}
export interface InitialStaffing {
  staffId: string;
  startsOn: string;
  endsOn: string;
  plannedHours: number;
  billable?: boolean;
}
export interface CreateProposalInput {
  scope: string;
  assumptions?: string;
  exclusions?: string;
  fee: number;
  phases: ProposalPhaseInput[];
  initialStaffing?: InitialStaffing[];
}
export interface ConvertOpportunityInput {
  proposalId: string;
  projectCode: string;
  location?: string;
  stage?: string;
}

const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
const requiredText = (value: string, label: string) => {
  const result = value?.trim();
  if (!result) throw new BadRequestException(`${label} is required.`);
  return result;
};
const optionalText = (value: string | undefined) => value?.trim() || null;
const nonNegative = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0)
    throw new BadRequestException(`${label} must be zero or greater.`);
  return value;
};
const probability = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 100)
    throw new BadRequestException('Probability must be a whole number from 0 to 100.');
  return value;
};
const normalizeStaffing = (items: InitialStaffing[]) =>
  items.map((item) => {
    const startsOn = requiredText(item.startsOn, 'Allocation start date');
    const endsOn = requiredText(item.endsOn, 'Allocation end date');
    if (new Date(startsOn) > new Date(endsOn))
      throw new BadRequestException('Allocation end date must be on or after its start date.');
    return {
      staffId: requiredText(item.staffId, 'Allocation staff ID'),
      startsOn,
      endsOn,
      plannedHours: nonNegative(item.plannedHours, 'Allocation planned hours'),
      billable: item.billable ?? true,
    };
  });
