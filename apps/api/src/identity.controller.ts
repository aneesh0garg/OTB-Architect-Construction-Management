import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard, type AuthenticatedRequest } from './keycloak-auth.guard.js';

@Controller('v1')
export class IdentityController {
  @Get('me')
  @UseGuards(KeycloakAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.actor;
  }
}
