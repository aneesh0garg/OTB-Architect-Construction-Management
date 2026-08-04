import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AiService } from './ai.service.js';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
class AiSettingsDto {
  @IsBoolean() enabled!: boolean;
}
class AiDraftDto {
  @IsIn([
    'rfi_draft',
    'site_report',
    'meeting_minutes',
    'risk_summary',
    'submittal_review',
    'document_classification',
    'record_search',
  ])
  intent!:
    | 'rfi_draft'
    | 'site_report'
    | 'meeting_minutes'
    | 'risk_summary'
    | 'submittal_review'
    | 'document_classification'
    | 'record_search';
  @IsString() @MinLength(2) @MaxLength(6000) prompt!: string;
}
class AiFeedbackDto {
  @IsIn(['correct', 'incorrect', 'incomplete', 'unsafe', 'not_useful']) rating!:
    'correct' | 'incorrect' | 'incomplete' | 'unsafe' | 'not_useful';
  @IsOptional() @IsString() @MaxLength(4000) correction?: string;
}
@Controller('v1')
@UseGuards(KeycloakAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Post('ai/settings') setEnabled(
    @Req() request: AuthenticatedRequest,
    @Body() body: AiSettingsDto,
  ) {
    return this.ai.setEnabled(request.actor!, body.enabled);
  }
  @Get('ai/records/export') exportRecords(@Req() request: AuthenticatedRequest) {
    return this.ai.exportRecords(request.actor!);
  }
  @Get('projects/:projectId/brain/search') search(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('q') query: string,
  ) {
    return this.ai.search(request.actor!, projectId, query);
  }
  @Post('projects/:projectId/brain/drafts') createDraft(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: AiDraftDto,
  ) {
    return this.ai.createDraft(request.actor!, projectId, body);
  }
  @Post('projects/:projectId/brain/drafts/:draftId/approve') approve(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
  ) {
    return this.ai.approveDraft(request.actor!, projectId, draftId);
  }
  @Post('projects/:projectId/brain/drafts/:draftId/reject') reject(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
  ) {
    return this.ai.rejectDraft(request.actor!, projectId, draftId);
  }
  @Post('projects/:projectId/brain/drafts/:draftId/feedback') feedback(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() body: AiFeedbackDto,
  ) {
    return this.ai.recordFeedback(request.actor!, projectId, draftId, body);
  }
  @Delete('projects/:projectId/brain/drafts/:draftId') deleteDraft(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
  ) {
    return this.ai.deleteDraft(request.actor!, projectId, draftId);
  }
}
