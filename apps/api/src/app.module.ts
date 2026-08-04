import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { IdentityController } from './identity.controller.js';
import { KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { ConstructionController } from './construction.controller.js';
import { ConstructionService } from './construction.service.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { GmailController } from './gmail.controller.js';
import { GmailService } from './gmail.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { AuditService } from './audit.service.js';

@Module({
  controllers: [
    HealthController,
    IdentityController,
    WorkspaceController,
    ConstructionController,
    FinanceController,
    AiController,
    GmailController,
  ],
  providers: [
    DatabaseService,
    ProjectAccessService,
    AuditService,
    KeycloakAuthGuard,
    WorkspaceService,
    ConstructionService,
    FinanceService,
    AiService,
    GmailService,
  ],
})
export class AppModule {}
