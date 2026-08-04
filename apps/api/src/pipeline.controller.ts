import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { PipelineService } from './pipeline.service.js';

class OpportunityDto {
  @IsString() @MinLength(2) @MaxLength(180) clientName!: string;
  @IsString() @MinLength(2) @MaxLength(180) projectName!: string;
  @IsOptional() @IsString() @MaxLength(80) projectType?: string;
  @IsOptional() @IsIn(['lead', 'qualified', 'proposal', 'negotiation']) stage?:
    'lead' | 'qualified' | 'proposal' | 'negotiation';
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsNumber() @Min(0) anticipatedFee?: number;
  @IsOptional() @IsISO8601() targetStartDate?: string;
  @IsOptional() @IsISO8601() targetEndDate?: string;
  @IsOptional() @IsString() @MaxLength(500) nextAction?: string;
}
class ProposalPhaseDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsNumber() @Min(0) plannedFee!: number;
  @IsNumber() @Min(0) targetHours!: number;
}
class InitialStaffingDto {
  @IsString() @MinLength(1) @MaxLength(160) staffId!: string;
  @IsISO8601() startsOn!: string;
  @IsISO8601() endsOn!: string;
  @IsNumber() @Min(0) plannedHours!: number;
  @IsOptional() @IsBoolean() billable?: boolean;
}
class ProposalDto {
  @IsString() @MinLength(2) @MaxLength(20_000) scope!: string;
  @IsOptional() @IsString() @MaxLength(10_000) assumptions?: string;
  @IsOptional() @IsString() @MaxLength(10_000) exclusions?: string;
  @IsNumber() @Min(0) fee!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProposalPhaseDto)
  phases!: ProposalPhaseDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InitialStaffingDto)
  initialStaffing?: InitialStaffingDto[];
}
class ConvertOpportunityDto {
  @IsString() @MinLength(1) @MaxLength(160) proposalId!: string;
  @IsString() @MinLength(2) @MaxLength(24) projectCode!: string;
  @IsOptional() @IsString() @MaxLength(240) location?: string;
  @IsOptional() @IsString() @MaxLength(80) stage?: string;
}

@Controller('v1/pipeline')
@UseGuards(KeycloakAuthGuard)
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get() list(@Req() request: AuthenticatedRequest) {
    return this.pipeline.list(request.actor!);
  }

  @Post('opportunities') create(
    @Req() request: AuthenticatedRequest,
    @Body() body: OpportunityDto,
  ) {
    return this.pipeline.createOpportunity(request.actor!, body);
  }

  @Post('opportunities/:opportunityId/proposals') createProposal(
    @Req() request: AuthenticatedRequest,
    @Param('opportunityId') opportunityId: string,
    @Body() body: ProposalDto,
  ) {
    return this.pipeline.createProposal(request.actor!, opportunityId, body);
  }

  @Post('opportunities/:opportunityId/convert') convert(
    @Req() request: AuthenticatedRequest,
    @Param('opportunityId') opportunityId: string,
    @Body() body: ConvertOpportunityDto,
  ) {
    return this.pipeline.convertToProject(request.actor!, opportunityId, body);
  }
}
