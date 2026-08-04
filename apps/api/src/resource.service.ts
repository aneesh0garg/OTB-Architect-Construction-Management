import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';

interface PersonRow extends QueryResultRow {
  user_id: string;
  display_name: string;
  title: string | null;
  weekly_capacity_hours: number;
  active: boolean;
  organization_role: string;
}
interface CapacityRow extends PersonRow {
  allocated_hours: number;
}
interface TeamRow extends QueryResultRow {
  id: string;
  name: string;
}
interface TeamMemberRow extends QueryResultRow {
  team_id: string;
  user_id: string;
  display_name: string;
  title: string | null;
  role: string;
}

@Injectable()
export class ResourceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async people(actor: AuthenticatedActor) {
    const result = await this.database.query<PersonRow>(
      'SELECT user_id, display_name, title, weekly_capacity_hours, active, organization_role FROM people WHERE organization_id = $1 ORDER BY active DESC, display_name',
      [actor.organizationId],
    );
    return result.rows;
  }

  async teams(actor: AuthenticatedActor) {
    const [teams, members] = await Promise.all([
      this.database.query<TeamRow>(
        'SELECT id, name FROM teams WHERE organization_id = $1 ORDER BY name',
        [actor.organizationId],
      ),
      this.database.query<TeamMemberRow>(
        `SELECT tm.team_id, tm.user_id, p.display_name, p.title, tm.role
         FROM team_members tm JOIN people p
           ON p.organization_id = tm.organization_id AND p.user_id = tm.user_id
         WHERE tm.organization_id = $1 ORDER BY p.display_name`,
        [actor.organizationId],
      ),
    ]);
    return teams.rows.map((team) => ({
      ...team,
      members: members.rows.filter((member) => member.team_id === team.id),
    }));
  }

  async capacity(actor: AuthenticatedActor, from: string, to: string) {
    const range = this.dateRange(from, to);
    const result = await this.database.query<CapacityRow>(
      `SELECT p.user_id, p.display_name, p.title, p.weekly_capacity_hours, p.active,
       COALESCE(SUM(a.planned_hours), 0)::real AS allocated_hours
       FROM people p
       LEFT JOIN staff_allocations a ON a.organization_id = p.organization_id
         AND a.staff_id = p.user_id AND a.starts_on <= $3::date AND a.ends_on >= $2::date
       WHERE p.organization_id = $1
       GROUP BY p.organization_id, p.user_id, p.display_name, p.title, p.weekly_capacity_hours, p.active
       ORDER BY p.active DESC, p.display_name`,
      [actor.organizationId, range.from, range.to],
    );
    const weeks = range.days / 7;
    return {
      from: range.from,
      to: range.to,
      people: result.rows.map((person) => {
        const capacityHours = Math.round(person.weekly_capacity_hours * weeks * 10) / 10;
        const allocatedHours = Number(person.allocated_hours);
        return {
          ...person,
          capacityHours,
          allocatedHours,
          availableHours: Math.round((capacityHours - allocatedHours) * 10) / 10,
          utilization: capacityHours ? Math.round((allocatedHours / capacityHours) * 100) : 0,
        };
      }),
    };
  }

  async upsertPerson(actor: AuthenticatedActor, input: UpsertPersonInput) {
    this.requireManager(actor);
    const result = await this.database.query<PersonRow>(
      `INSERT INTO people (organization_id, user_id, display_name, title, weekly_capacity_hours, active, organization_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET display_name = EXCLUDED.display_name, title = EXCLUDED.title, weekly_capacity_hours = EXCLUDED.weekly_capacity_hours, active = EXCLUDED.active, organization_role = EXCLUDED.organization_role
       RETURNING user_id, display_name, title, weekly_capacity_hours, active, organization_role`,
      [
        actor.organizationId,
        text(input.userId, 'User ID'),
        text(input.displayName, 'Display name'),
        input.title?.trim() || null,
        input.weeklyCapacityHours ?? 40,
        input.active ?? true,
        input.organizationRole,
      ],
    );
    const person = row(result.rows, 'Person could not be saved.');
    await this.audit.record(actor, 'resource.person_saved', 'person', person.user_id, {
      userId: person.user_id,
      weeklyCapacityHours: person.weekly_capacity_hours,
      active: person.active,
      organizationRole: person.organization_role,
    });
    return person;
  }

  async addToTeam(actor: AuthenticatedActor, input: AddToTeamInput) {
    this.requireManager(actor);
    const team = await this.database.query<QueryResultRow>(
      'SELECT id FROM teams WHERE id = $1 AND organization_id = $2',
      [input.teamId, actor.organizationId],
    );
    if (!team.rows[0]) throw new BadRequestException('Team is unavailable.');
    const person = await this.database.query<PersonRow>(
      'SELECT user_id, display_name, title, weekly_capacity_hours, active FROM people WHERE organization_id = $1 AND user_id = $2',
      [actor.organizationId, input.userId],
    );
    if (!person.rows[0]) throw new BadRequestException('Add the person before assigning a team.');
    await this.database.query(
      'INSERT INTO team_members (team_id, organization_id, user_id, role) VALUES ($1,$2,$3,$4) ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role',
      [input.teamId, actor.organizationId, input.userId, input.role ?? 'member'],
    );
    await this.audit.record(actor, 'resource.team_assignment_saved', 'team', input.teamId, {
      userId: input.userId,
      role: input.role ?? 'member',
    });
    return { teamId: input.teamId, userId: input.userId, role: input.role ?? 'member' };
  }

  private requireManager(actor: AuthenticatedActor) {
    if (
      !actor.roles.some((role) =>
        ['organization_admin', 'principal', 'project_manager'].includes(role),
      )
    )
      throw new BadRequestException('Resource manager permission is required.');
  }
  private dateRange(from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end)
      throw new BadRequestException('Use a valid date range.');
    const days = Math.floor((end.valueOf() - start.valueOf()) / 86_400_000) + 1;
    if (days > 366) throw new BadRequestException('Capacity range cannot exceed one year.');
    return { from, to, days };
  }
}

export interface UpsertPersonInput {
  userId: string;
  displayName: string;
  title?: string;
  weeklyCapacityHours?: number;
  active?: boolean;
  organizationRole: string;
}
export interface AddToTeamInput {
  teamId: string;
  userId: string;
  role?: string;
}

const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
const text = (value: string, label: string) => {
  const result = value?.trim();
  if (!result) throw new BadRequestException(`${label} is required.`);
  return result;
};
