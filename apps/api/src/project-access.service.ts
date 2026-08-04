import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from './database.service.js';

const organizationWideRoles = [
  'organization_admin',
  'principal',
  'finance_admin',
  'project_manager',
];

@Injectable()
export class ProjectAccessService {
  constructor(private readonly database: DatabaseService) {}

  async requireAccess(actor: AuthenticatedActor, projectId: string) {
    const project = await this.database.query<QueryResultRow>(
      'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
      [projectId, actor.organizationId],
    );
    if (!project.rows[0])
      throw new BadRequestException('Project is unavailable in this organization.');
    if (actor.roles.some((role) => organizationWideRoles.includes(role))) return;
    const member = await this.database.query<QueryResultRow>(
      'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, actor.userId],
    );
    if (!member.rows[0]) throw new BadRequestException('Project membership is required.');
  }
}
