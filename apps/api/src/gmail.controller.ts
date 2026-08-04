import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GmailService } from './gmail.service.js';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
@Controller('v1/integrations/gmail')
export class GmailController {
  constructor(private readonly gmail: GmailService) {}
  @Get() @UseGuards(KeycloakAuthGuard) list(@Req() request: AuthenticatedRequest) {
    return this.gmail.list(request.actor!);
  }
  @Post('connect') @UseGuards(KeycloakAuthGuard) connect(@Req() request: AuthenticatedRequest) {
    return this.gmail.start(request.actor!);
  }
  @Get('callback') callback(@Query('code') code: string, @Query('state') state: string) {
    return this.gmail.complete(code, state);
  }
  @Post(':connectionId/disconnect') @UseGuards(KeycloakAuthGuard) disconnect(
    @Req() request: AuthenticatedRequest,
    @Param('connectionId') connectionId: string,
  ) {
    return this.gmail.disconnect(request.actor!, connectionId);
  }
}
