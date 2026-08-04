import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContactService } from './contact.service.js';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';

class ContactDto {
  @IsString() @MinLength(2) @MaxLength(160) displayName!: string;
  @IsOptional() @IsString() @MaxLength(160) companyName?: string;
  @IsOptional() @IsString() @MaxLength(240) email?: string;
  @IsOptional() @IsString() @MaxLength(80) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) discipline?: string;
  @IsOptional() @IsString() @MaxLength(120) role?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class ContactProjectDto {
  @IsString() @MinLength(1) @MaxLength(160) projectId!: string;
  @IsString() @MinLength(2) @MaxLength(80) relationship!: string;
}

@Controller('v1/contacts')
@UseGuards(KeycloakAuthGuard)
export class ContactController {
  constructor(private readonly contacts: ContactService) {}

  @Get() list(@Req() request: AuthenticatedRequest, @Query('q') query?: string) {
    return this.contacts.list(request.actor!, query);
  }

  @Post() save(@Req() request: AuthenticatedRequest, @Body() body: ContactDto) {
    return this.contacts.save(request.actor!, body);
  }

  @Post(':contactId/projects') linkProject(
    @Req() request: AuthenticatedRequest,
    @Param('contactId') contactId: string,
    @Body() body: ContactProjectDto,
  ) {
    return this.contacts.linkProject(request.actor!, contactId, body);
  }
}
