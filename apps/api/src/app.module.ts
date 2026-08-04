import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { IdentityController } from './identity.controller.js';
import { KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { ConstructionController } from './construction.controller.js';
import { ConstructionService } from './construction.service.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';

@Module({
  controllers: [HealthController, IdentityController, WorkspaceController, ConstructionController],
  providers: [KeycloakAuthGuard, WorkspaceService, ConstructionService],
})
export class AppModule {}
