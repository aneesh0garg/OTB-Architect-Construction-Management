import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { projectStages, WorkspaceService } from './workspace.service.js';
import { DocumentUploadService } from './document-upload.service.js';
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
  @IsOptional() @IsIn(projectStages) stage?: (typeof projectStages)[number];
}
class ProjectStatusDto {
  @IsIn(['active', 'on_hold', 'closed', 'archived']) status!: string;
}
class ProjectStageDto {
  @IsIn(projectStages) stage!: (typeof projectStages)[number];
}
class AddCollaboratorDto {
  @IsString() @MinLength(1) @MaxLength(160) userId!: string;
  @IsIn(['contractor', 'consultant', 'owner', 'vendor', 'project_member', 'field_supervisor'])
  role!: string;
}
class CreateTaskDto {
  @IsString() @MinLength(2) @MaxLength(240) title!: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'critical']) priority?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(160) assigneeId?: string;
  @IsOptional() @IsString() @MaxLength(80) sourceRecordType?: string;
  @IsOptional() @IsString() @MaxLength(160) sourceRecordId?: string;
}
class TaskStatusDto {
  @IsIn(['in_progress', 'blocked', 'completed', 'cancelled']) status!: string;
}
class CreateDocumentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(48) documentNumber?: string;
  @IsIn(['drawing', 'specification', 'report', 'contract', 'photo', 'other']) documentType!: string;
  @IsString() @MinLength(2) @MaxLength(240) title!: string;
  @IsString() @MinLength(1) @MaxLength(24) revision!: string;
  @IsOptional() @IsIn(['draft', 'issued']) status?: string;
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsString() @MaxLength(80) discipline?: string;
  @IsOptional() @IsString() @MaxLength(120) building?: string;
  @IsOptional() @IsString() @MaxLength(80) floor?: string;
  @IsOptional() @IsString() @MaxLength(120) zone?: string;
  @IsOptional() @IsString() @MaxLength(160) uploadId?: string;
  @IsOptional() @IsString() @MaxLength(160) supersedesDocumentId?: string;
  @IsOptional() @IsString() @MaxLength(160) clientRequestId?: string;
}
class CreateDocumentAnnotationDto {
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
  @IsOptional() @IsNumber() @Min(1) pageNumber?: number;
  @IsOptional() @IsNumber() @Min(0) xPercent?: number;
  @IsOptional() @IsNumber() @Min(0) yPercent?: number;
}
class DocumentReviewDto {
  @IsIn(['submit', 'approve', 'reject']) action!: 'submit' | 'approve' | 'reject';
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
class CreateTransmittalDto {
  @IsString() @MinLength(2) @MaxLength(240) purpose!: string;
  @IsOptional() @IsString() @MaxLength(2000) issueNote?: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) recipients!: string[];
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) documentIds!: string[];
}
class CreateDocumentUploadDto {
  @IsString() @MinLength(1) @MaxLength(160) fileName!: string;
  @IsString() @MinLength(3) @MaxLength(120) contentType!: string;
  @IsNumber() @Min(1) size!: number;
}
class CreateDocumentUploadBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentUploadDto)
  files!: CreateDocumentUploadDto[];
}
class FileCommunicationDto {
  @IsIn(['email', 'whatsapp_business', 'manual_note']) channel!: string;
  @IsIn(['inbound', 'outbound', 'internal']) direction!: string;
  @IsString() @MinLength(2) @MaxLength(240) subject!: string;
  @IsString() @MinLength(1) @MaxLength(20000) body!: string;
  @IsString() @MinLength(1) @MaxLength(240) sender!: string;
  @IsArray() @IsString({ each: true }) recipients!: string[];
  @IsOptional() @IsString() @MaxLength(240) threadId?: string;
  @IsOptional() @IsString() @MaxLength(240) sourceMessageId?: string;
}
class UpdateNotificationPreferenceDto {
  @IsString() @MinLength(1) @MaxLength(80) eventType!: string;
  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursStart?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursEnd?: string;
  @IsOptional() @IsIn(['immediate', 'daily', 'weekly', 'none']) digestFrequency?: string;
}
@Controller('v1/workspace')
@UseGuards(KeycloakAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly uploads: DocumentUploadService,
  ) {}
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
  @Delete('projects/:projectId/collaborators/:userId') removeCollaborator(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.workspace.removeCollaborator(request.actor!, projectId, userId);
  }
  @Post('projects/:projectId/status') transitionProjectStatus(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: ProjectStatusDto,
  ) {
    return this.workspace.transitionProjectStatus(request.actor!, projectId, body.status);
  }
  @Post('projects/:projectId/stage') transitionProjectStage(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: ProjectStageDto,
  ) {
    return this.workspace.transitionProjectStage(request.actor!, projectId, body.stage);
  }
  @Get('projects/:projectId/record') getProjectRecord(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.workspace.getProjectRecord(request.actor!, projectId);
  }
  @Get('projects/:projectId/collaborators') getProjectCollaborators(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.workspace.getProjectCollaborators(request.actor!, projectId);
  }
  @Post('projects/:projectId/tasks') createTask(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: CreateTaskDto,
  ) {
    return this.workspace.createTask(request.actor!, projectId, body);
  }
  @Post('projects/:projectId/tasks/:taskId/status') transitionTaskStatus(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() body: TaskStatusDto,
  ) {
    return this.workspace.transitionTaskStatus(request.actor!, projectId, taskId, body.status);
  }
  @Post('projects/:projectId/documents') addDocumentRevision(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: CreateDocumentDto,
  ) {
    return this.workspace.addDocumentRevision(request.actor!, projectId, body);
  }
  @Post('projects/:projectId/documents/:documentId/issue') issueDocumentRevision(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.workspace.issueDocumentRevision(request.actor!, projectId, documentId);
  }
  @Post('projects/:projectId/documents/:documentId/review') reviewDocumentRevision(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() body: DocumentReviewDto,
  ) {
    return this.workspace.reviewDocumentRevision(request.actor!, projectId, documentId, body);
  }
  @Post('projects/:projectId/transmittals') createTransmittal(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: CreateTransmittalDto,
  ) {
    return this.workspace.createTransmittal(request.actor!, projectId, body);
  }
  @Post('projects/:projectId/documents/uploads') createDocumentUpload(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: CreateDocumentUploadDto,
  ) {
    return this.uploads.create(request.actor!, projectId, body);
  }
  @Post('projects/:projectId/documents/uploads/batch') createDocumentUploadBatch(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: CreateDocumentUploadBatchDto,
  ) {
    return this.uploads.createBatch(request.actor!, projectId, body.files);
  }
  @Post('projects/:projectId/documents/uploads/:uploadId/complete') completeDocumentUpload(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('uploadId') uploadId: string,
  ) {
    return this.uploads.complete(request.actor!, projectId, uploadId);
  }
  @Get('projects/:projectId/documents/:documentId/download') downloadDocument(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.uploads.download(request.actor!, projectId, documentId);
  }
  @Get('projects/:projectId/documents/:documentId/annotations') getDocumentAnnotations(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.workspace.getDocumentAnnotations(request.actor!, projectId, documentId);
  }
  @Post('projects/:projectId/documents/:documentId/annotations') createDocumentAnnotation(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() body: CreateDocumentAnnotationDto,
  ) {
    return this.workspace.createDocumentAnnotation(request.actor!, projectId, documentId, body);
  }
  @Post('projects/:projectId/communications') fileCommunication(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: FileCommunicationDto,
  ) {
    return this.workspace.fileCommunication(request.actor!, projectId, body);
  }
  @Get('notifications') getNotifications(@Req() request: AuthenticatedRequest) {
    return this.workspace.getNotifications(request.actor!);
  }
  @Get('my-tasks') getMyTasks(@Req() request: AuthenticatedRequest) {
    return this.workspace.getMyTasks(request.actor!);
  }
  @Get('notification-preferences') getNotificationPreferences(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workspace.getNotificationPreferences(request.actor!);
  }
  @Put('notification-preferences') updateNotificationPreference(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateNotificationPreferenceDto,
  ) {
    return this.workspace.updateNotificationPreference(request.actor!, body);
  }
  @Get('audit') getAuditEvents(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId?: string,
  ) {
    return this.workspace.getAuditEvents(request.actor!, projectId);
  }
  @Post('notifications/:notificationId/read') markNotificationRead(
    @Req() request: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.workspace.markNotificationRead(request.actor!, notificationId);
  }
}
