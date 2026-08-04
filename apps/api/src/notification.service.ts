import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from './database.service.js';

@Injectable()
export class NotificationService {
  constructor(private readonly database: DatabaseService) {}

  async notifyProject(
    actor: AuthenticatedActor,
    projectId: string,
    eventType: string,
    title: string,
    body: string,
  ) {
    const members = await this.database.query<QueryResultRow & { user_id: string }>(
      'SELECT user_id FROM project_members WHERE project_id = $1',
      [projectId],
    );
    const recipients = new Set([actor.userId, ...members.rows.map((member) => member.user_id)]);
    await Promise.all(
      [...recipients].map((userId) =>
        this.deliver(actor.organizationId, userId, projectId, eventType, title, body),
      ),
    );
  }
  private async deliver(
    organizationId: string,
    userId: string,
    projectId: string,
    eventType: string,
    title: string,
    body: string,
  ) {
    const preference = await this.database.query<{ in_app_enabled: boolean }>(
      "SELECT in_app_enabled FROM notification_preferences WHERE organization_id = $1 AND user_id = $2 AND event_type IN ($3, '*') ORDER BY CASE WHEN event_type = $3 THEN 0 ELSE 1 END LIMIT 1",
      [organizationId, userId, eventType],
    );
    if (preference.rows[0]?.in_app_enabled === false) return;
    await this.database.query(
      'INSERT INTO notifications (organization_id, user_id, project_id, event_type, title, body) VALUES ($1,$2,$3,$4,$5,$6)',
      [organizationId, userId, projectId, eventType, title, body],
    );
  }
}
