import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsIn,
} from 'class-validator';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { ResourceService } from './resource.service.js';

class PersonDto {
  @IsString() @MinLength(1) @MaxLength(160) userId!: string;
  @IsString() @MinLength(2) @MaxLength(160) displayName!: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(80) weeklyCapacityHours?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsIn(['principal', 'project_manager', 'project_member', 'field_supervisor', 'finance_admin', 'contractor', 'consultant', 'owner', 'vendor']) organizationRole!: string;
}
class TeamMemberDto {
  @IsString() @MinLength(1) @MaxLength(160) teamId!: string;
  @IsString() @MinLength(1) @MaxLength(160) userId!: string;
  @IsOptional() @IsString() @MaxLength(80) role?: string;
}

@Controller('v1/resources')
@UseGuards(KeycloakAuthGuard)
export class ResourceController {
  constructor(private readonly resources: ResourceService) {}

  @Get('people') people(@Req() request: AuthenticatedRequest) {
    return this.resources.people(request.actor!);
  }
  @Get('teams') teams(@Req() request: AuthenticatedRequest) {
    return this.resources.teams(request.actor!);
  }
  @Get('capacity') capacity(
    @Req() request: AuthenticatedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.resources.capacity(request.actor!, from, to);
  }
  @Post('people') savePerson(@Req() request: AuthenticatedRequest, @Body() body: PersonDto) {
    return this.resources.upsertPerson(request.actor!, body);
  }
  @Post('team-members') addToTeam(
    @Req() request: AuthenticatedRequest,
    @Body() body: TeamMemberDto,
  ) {
    return this.resources.addToTeam(request.actor!, body);
  }
}
