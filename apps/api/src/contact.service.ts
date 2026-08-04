import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';

interface ContactRow extends QueryResultRow {
  id: string;
  display_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  discipline: string | null;
  role: string | null;
  address: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
interface RelationshipRow extends QueryResultRow {
  contact_id: string;
  project_id: string;
  relationship: string;
}

@Injectable()
export class ContactService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthenticatedActor, query?: string) {
    const term = query?.trim();
    const contacts = await this.database.query<ContactRow>(
      `SELECT id, display_name, company_name, email, phone, discipline, role, address, active,
        created_at, updated_at FROM contacts
       WHERE organization_id = $1
         AND ($2::text IS NULL OR display_name ILIKE $2 OR company_name ILIKE $2 OR email ILIKE $2)
       ORDER BY active DESC, display_name LIMIT 200`,
      [actor.organizationId, term ? `%${term.replace(/[%_]/g, '')}%` : null],
    );
    const relationships = await this.database.query<RelationshipRow>(
      `SELECT cp.contact_id, cp.project_id, cp.relationship FROM contact_projects cp
       WHERE cp.organization_id = $1 AND cp.contact_id = ANY($2::uuid[])`,
      [actor.organizationId, contacts.rows.map((contact) => contact.id)],
    );
    return contacts.rows.map((contact) => ({
      ...contact,
      projects: relationships.rows.filter((item) => item.contact_id === contact.id),
    }));
  }

  async save(actor: AuthenticatedActor, input: SaveContactInput) {
    this.requireManager(actor);
    const result = await this.database.query<ContactRow>(
      `INSERT INTO contacts (organization_id, display_name, company_name, email, phone, discipline,
        role, address, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (organization_id, lower(email)) WHERE email IS NOT NULL
       DO UPDATE SET display_name = EXCLUDED.display_name, company_name = EXCLUDED.company_name,
         phone = EXCLUDED.phone, discipline = EXCLUDED.discipline, role = EXCLUDED.role,
         address = EXCLUDED.address, active = EXCLUDED.active, updated_at = NOW()
       RETURNING id, display_name, company_name, email, phone, discipline, role, address, active,
         created_at, updated_at`,
      [
        actor.organizationId,
        text(input.displayName, 'Contact name'),
        optional(input.companyName),
        email(input.email),
        optional(input.phone),
        optional(input.discipline),
        optional(input.role),
        optional(input.address),
        input.active ?? true,
        actor.userId,
      ],
    );
    const contact = row(result.rows, 'Contact could not be saved.');
    await this.audit.record(actor, 'contact.saved', 'contact', contact.id, {
      email: contact.email,
      companyName: contact.company_name,
      active: contact.active,
    });
    return contact;
  }

  async linkProject(actor: AuthenticatedActor, contactId: string, input: LinkContactProjectInput) {
    this.requireManager(actor);
    const [contact, project] = await Promise.all([
      this.database.query<QueryResultRow>(
        'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
        [contactId, actor.organizationId],
      ),
      this.database.query<QueryResultRow>(
        'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
        [input.projectId, actor.organizationId],
      ),
    ]);
    if (!contact.rows[0] || !project.rows[0])
      throw new BadRequestException('Contact or project is unavailable.');
    const relationship = text(input.relationship, 'Project relationship');
    await this.database.query(
      `INSERT INTO contact_projects (contact_id, project_id, organization_id, relationship, created_by)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (contact_id, project_id, relationship) DO NOTHING`,
      [contactId, input.projectId, actor.organizationId, relationship, actor.userId],
    );
    await this.audit.record(actor, 'contact.project_linked', 'contact', contactId, {
      projectId: input.projectId,
      relationship,
    });
    return { contactId, projectId: input.projectId, relationship };
  }

  private requireManager(actor: AuthenticatedActor) {
    if (
      !actor.roles.some((role) =>
        ['organization_admin', 'principal', 'project_manager'].includes(role),
      )
    )
      throw new BadRequestException('Contact manager permission is required.');
  }
}

export interface SaveContactInput {
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  discipline?: string;
  role?: string;
  address?: string;
  active?: boolean;
}
export interface LinkContactProjectInput {
  projectId: string;
  relationship: string;
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
const optional = (value: string | undefined) => value?.trim() || null;
const email = (value: string | undefined) => {
  const result = optional(value);
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new BadRequestException('Use a valid contact email address.');
  return result;
};
