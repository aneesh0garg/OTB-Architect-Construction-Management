import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { WorkspaceService } from './workspace.service.js';
class CreateOrganizationDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
}
class CreateTeamDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
}
class CreateProjectDto {
  @IsString() @MinLength(2) @MaxLength(24) code!: string;
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(240) location?: string;
  @IsOptional() @IsString() @MaxLength(80) stage?: string;
}
class AddCollaboratorDto {
  @IsString() @MinLength(1) @MaxLength(160) userId!: string;
  @IsIn(['contractor', 'consultant', 'owner', 'vendor', 'project_member', 'field_supervisor'])
  role!: string;
}
@Controller('v1/workspace')
@UseGuards(KeycloakAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get() getWorkspace(@Req() request: AuthenticatedRequest) {
    return this.workspace.getWorkspace(request.actor!);
  }
  @Post('organization') createOrganization(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateOrganizationDto,
  ) {
    return this.workspace.createOrganization(request.actor!, body.name);
  }
  @Post('teams') createTeam(@Req() request: AuthenticatedRequest, @Body() body: CreateTeamDto) {
    return this.workspace.createTeam(request.actor!, body.name);
  }
  @Post('projects') createProject(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateProjectDto,
  ) {
    return this.workspace.createProject(request.actor!, body);
  }
  @Post('projects/:projectId/collaborators') addCollaborator(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: AddCollaboratorDto,
  ) {
    return this.workspace.addCollaborator(request.actor!, projectId, body);
  }
}
