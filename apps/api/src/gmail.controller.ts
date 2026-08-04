import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsString, MaxLength, MinLength } from 'class-validator';
import { GmailService } from './gmail.service.js';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
class FileGmailMessageDto {
  @IsString() @MinLength(1) @MaxLength(160) projectId!: string;
}
class SendGmailMessageDto {
  @IsString() @MinLength(1) @MaxLength(160) projectId!: string;
  @IsArray() @IsString({ each: true }) recipients!: string[];
  @IsString() @MinLength(1) @MaxLength(240) subject!: string;
  @IsString() @MinLength(1) @MaxLength(20000) body!: string;
}
@Controller('v1/integrations/gmail')
export class GmailController {
  constructor(private readonly gmail: GmailService) {}
  @Get() @UseGuards(KeycloakAuthGuard) list(@Req() request: AuthenticatedRequest) {
    return this.gmail.list(request.actor!);
  }
  @Post('connect') @UseGuards(KeycloakAuthGuard) connect(@Req() request: AuthenticatedRequest) {
    return this.gmail.start(request.actor!);
  }
  @Get(':connectionId/messages') @UseGuards(KeycloakAuthGuard) messages(
    @Req() request: AuthenticatedRequest,
    @Param('connectionId') connectionId: string,
    @Query('q') search?: string,
  ) {
    return this.gmail.messages(request.actor!, connectionId, search);
  }
  @Post(':connectionId/messages/:messageId/file') @UseGuards(KeycloakAuthGuard) fileMessage(
    @Req() request: AuthenticatedRequest,
    @Param('connectionId') connectionId: string,
    @Param('messageId') messageId: string,
    @Body() body: FileGmailMessageDto,
  ) {
    return this.gmail.fileMessage(request.actor!, connectionId, messageId, body.projectId);
  }
  @Post(':connectionId/messages/send') @UseGuards(KeycloakAuthGuard) sendMessage(
    @Req() request: AuthenticatedRequest,
    @Param('connectionId') connectionId: string,
    @Body() body: SendGmailMessageDto,
  ) {
    return this.gmail.sendMessage(request.actor!, connectionId, body);
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
