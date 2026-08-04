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
import { ProjectSearchController } from './project-search.controller.js';
import { ProjectSearchService } from './project-search.service.js';
import { ResourceController } from './resource.controller.js';
import { ResourceService } from './resource.service.js';
import { ProjectExportController } from './project-export.controller.js';
import { ProjectExportService } from './project-export.service.js';
import { NotificationService } from './notification.service.js';
import { ZohoBooksController } from './zoho-books.controller.js';
import { ZohoBooksService } from './zoho-books.service.js';
import { DocumentUploadService } from './document-upload.service.js';
import { PipelineController } from './pipeline.controller.js';
import { PipelineService } from './pipeline.service.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  controllers: [
    HealthController,
    IdentityController,
    WorkspaceController,
    ConstructionController,
    FinanceController,
    AiController,
    GmailController,
    ProjectSearchController,
    ResourceController,
    ProjectExportController,
    ZohoBooksController,
    PipelineController,
    ContactController,
  ],
  providers: [
    DatabaseService,
    ProjectAccessService,
    AuditService,
    ProjectSearchService,
    ResourceService,
    ProjectExportService,
    NotificationService,
    ZohoBooksService,
    DocumentUploadService,
    KeycloakAuthGuard,
    WorkspaceService,
    ConstructionService,
    FinanceService,
    AiService,
    GmailService,
    PipelineService,
    ContactService,
  ],
})
export class AppModule {}
