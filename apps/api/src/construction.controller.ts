import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ConstructionService } from './construction.service.js';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
class VisitDto {
  @IsISO8601() visitDate!: string;
  @IsString() @MinLength(2) @MaxLength(240) location!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) attendees?: string[];
  @IsOptional() @IsString() weather?: string;
  @IsOptional() @IsArray() checklist?: unknown[];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsIn(['local', 'syncing', 'synced', 'failed', 'conflict']) syncState?: string;
  @IsOptional() @IsString() clientCaptureId?: string;
}
class ObservationDto {
  @IsString() @MinLength(2) @MaxLength(240) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() fieldVisitId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() trade?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'critical']) priority?: string;
  @IsOptional() @IsArray() evidence?: unknown[];
  @IsOptional() @IsIn(['local', 'syncing', 'synced', 'failed', 'conflict']) syncState?: string;
  @IsOptional() @IsString() clientCaptureId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
}
class WorkflowDto {
  @IsIn([
    'rfi',
    'submittal',
    'site_instruction',
    'meeting_minutes',
    'site_visit_report',
    'decision',
  ])
  recordType!:
    'rfi' | 'submittal' | 'site_instruction' | 'meeting_minutes' | 'site_visit_report' | 'decision';
  @IsString() @MinLength(2) @MaxLength(240) title!: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
}
class TransitionDto {
  @IsString() @MinLength(2) @MaxLength(40) status!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
@Controller('v1/projects/:projectId')
@UseGuards(KeycloakAuthGuard)
export class ConstructionController {
  constructor(private readonly construction: ConstructionService) {}
  @Get('execution-register') getRegister(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.construction.getRegister(request.actor!, projectId);
  }
  @Post('field-visits') createVisit(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: VisitDto,
  ) {
    return this.construction.createFieldVisit(request.actor!, projectId, body);
  }
  @Post('observations') createObservation(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: ObservationDto,
  ) {
    return this.construction.createObservation(request.actor!, projectId, body);
  }
  @Post('workflows') createWorkflow(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: WorkflowDto,
  ) {
    return this.construction.createWorkflowRecord(request.actor!, projectId, body);
  }
  @Post('workflows/:recordId/transitions') transition(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('recordId') recordId: string,
    @Body() body: TransitionDto,
  ) {
    return this.construction.transitionWorkflowRecord(request.actor!, projectId, recordId, body);
  }
}
