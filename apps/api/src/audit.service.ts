import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async record(
    actor: AuthenticatedActor,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.database.query(
      'INSERT INTO audit_events (organization_id, actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [actor.organizationId, actor.userId, action, entityType, entityId, JSON.stringify(metadata)],
    );
  }
}
