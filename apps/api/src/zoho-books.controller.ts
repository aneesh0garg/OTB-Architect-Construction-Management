import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { ZohoBooksService } from './zoho-books.service.js';

@Controller('v1/integrations/zoho-books')
export class ZohoBooksController {
  constructor(private readonly zoho: ZohoBooksService) {}

  @Get()
  @UseGuards(KeycloakAuthGuard)
  list(@Req() request: AuthenticatedRequest) {
    return this.zoho.list(request.actor!);
  }
  @Post('connect')
  @UseGuards(KeycloakAuthGuard)
  connect(@Req() request: AuthenticatedRequest) {
    return this.zoho.start(request.actor!);
  }
  @Get('callback')
  callback(@Query('code') code: string, @Query('state') state: string) {
    return this.zoho.complete(code, state);
  }
  @Post(':connectionId/disconnect')
  @UseGuards(KeycloakAuthGuard)
  disconnect(@Req() request: AuthenticatedRequest, @Param('connectionId') connectionId: string) {
    return this.zoho.disconnect(request.actor!, connectionId);
  }
}
