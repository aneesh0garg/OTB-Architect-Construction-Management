import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { ProjectSearchService } from './project-search.service.js';

@Controller('v1/projects/:projectId/search')
@UseGuards(KeycloakAuthGuard)
export class ProjectSearchController {
  constructor(private readonly search: ProjectSearchService) {}

  @Get()
  getResults(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('q') query: string,
  ) {
    return this.search.search(request.actor!, projectId, query);
  }
}
