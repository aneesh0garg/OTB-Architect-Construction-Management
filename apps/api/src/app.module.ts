import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { IdentityController } from './identity.controller.js';
import { KeycloakAuthGuard } from './keycloak-auth.guard.js';

@Module({ controllers: [HealthController, IdentityController], providers: [KeycloakAuthGuard] })
export class AppModule {}
