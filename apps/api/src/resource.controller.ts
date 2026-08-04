import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  IsEmail,
} from 'class-validator';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { ResourceService } from './resource.service.js';
import { ProfilePhotoService } from './profile-photo.service.js';

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
class InvitePersonDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(2) @MaxLength(160) displayName!: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(80) weeklyCapacityHours?: number;
  @IsIn(['principal', 'project_manager', 'project_member', 'field_supervisor', 'finance_admin', 'contractor', 'consultant', 'owner', 'vendor']) organizationRole!: string;
}
class ProfilePhotoDto { @IsString() @MinLength(1) @MaxLength(255) fileName!: string; @IsString() @IsIn(['image/jpeg', 'image/png', 'image/webp']) contentType!: string; @IsNumber() @Min(1) @Max(5242880) size!: number; }

@Controller('v1/resources')
@UseGuards(KeycloakAuthGuard)
export class ResourceController {
  constructor(private readonly resources: ResourceService, private readonly photos: ProfilePhotoService) {}

  @Get('people') people(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.resources.people(request.actor!, page, pageSize);
  }
  @Get('people/:userId') person(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.resources.person(request.actor!, userId);
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
  @Post('people/invitations') invitePerson(@Req() request: AuthenticatedRequest, @Body() body: InvitePersonDto) {
    return this.resources.invitePerson(request.actor!, body);
  }
  @Get('people/:userId/profile-photo') profilePhoto(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.photos.url(request.actor!, userId);
  }
  @Post('people/:userId/profile-photo/uploads') prepareProfilePhoto(@Req() request: AuthenticatedRequest, @Param('userId') userId: string, @Body() body: ProfilePhotoDto) {
    return this.photos.prepare(request.actor!, userId, body);
  }
  @Post('people/:userId/profile-photo/uploads/:uploadId/complete') completeProfilePhoto(@Req() request: AuthenticatedRequest, @Param('userId') userId: string, @Param('uploadId') uploadId: string) {
    return this.photos.complete(request.actor!, userId, uploadId);
  }
  @Post('team-members') addToTeam(
    @Req() request: AuthenticatedRequest,
    @Body() body: TeamMemberDto,
  ) {
    return this.resources.addToTeam(request.actor!, body);
  }
}
