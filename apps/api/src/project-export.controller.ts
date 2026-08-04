import { Controller, Get, Header, Param, Req, UseGuards } from '@nestjs/common';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { ProjectExportService } from './project-export.service.js';

@Controller('v1/projects/:projectId/exports')
@UseGuards(KeycloakAuthGuard)
export class ProjectExportController {
  constructor(private readonly exports: ProjectExportService) {}

  @Get('project.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  project(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.exports.projectCsv(request.actor!, projectId);
  }

  @Get('commercial.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  commercial(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.exports.commercialCsv(request.actor!, projectId);
  }

  @Get('project.json')
  @Header('content-type', 'application/json; charset=utf-8')
  projectPackage(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.exports.projectPackage(request.actor!, projectId);
  }
}
