import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FinanceService } from './finance.service.js';
import { ZohoBooksService } from './zoho-books.service.js';
import { type AuthenticatedRequest, KeycloakAuthGuard } from './keycloak-auth.guard.js';
class PhaseDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsNumber() @Min(0) plannedFee!: number;
  @IsNumber() @Min(0) targetHours!: number;
}
class AllocationDto {
  @IsOptional() @IsString() phaseId?: string;
  @IsString() @MinLength(1) staffId!: string;
  @IsISO8601() startsOn!: string;
  @IsISO8601() endsOn!: string;
  @IsNumber() @Min(0) plannedHours!: number;
  @IsOptional() @IsBoolean() billable?: boolean;
}
class TimeDto {
  @IsOptional() @IsString() phaseId?: string;
  @IsOptional() @IsString() taskId?: string;
  @IsISO8601() entryDate!: string;
  @IsNumber() @Min(0.01) hours!: number;
  @IsOptional() @IsBoolean() billable?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
class InvoiceLineDto {
  @IsString() @MinLength(2) sourceType!: string;
  @IsOptional() @IsString() sourceId?: string;
  @IsString() @MinLength(2) @MaxLength(240) description!: string;
  @IsNumber() @Min(0.01) quantity!: number;
  @IsNumber() @Min(0) unitAmount!: number;
}
class InvoiceDto {
  @IsString() @MinLength(2) clientName!: string;
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsNumber() @Min(0) gstRate?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceLineDto) lines!: InvoiceLineDto[];
}
class InvoiceStatusDto {
  @IsIn([
    'draft',
    'internal_review',
    'issued',
    'partially_paid',
    'paid',
    'overdue',
    'void',
    'written_off',
  ])
  status!: string;
}
class PaymentDto {
  @IsNumber() @Min(0.01) amount!: number;
  @IsISO8601() paidDate!: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}
class TimeStatusDto {
  @IsIn(['submitted', 'approved', 'locked']) status!: string;
}
class BudgetDto {
  @IsString() @MinLength(1) @MaxLength(80) costCode!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsNumber() @Min(0) amount!: number;
}
class CommitmentDto {
  @IsString() @MinLength(2) @MaxLength(160) vendorName!: string;
  @IsString() @MinLength(2) @MaxLength(240) description!: string;
  @IsNumber() @Min(0) originalAmount!: number;
  @IsOptional() @IsNumber() @Min(0) approvedAmount?: number;
  @IsOptional() @IsIn(['draft', 'approved', 'active', 'closed']) status?: string;
}
class ChangeEventDto {
  @IsString() @MinLength(1) @MaxLength(80) code!: string;
  @IsString() @MinLength(2) @MaxLength(240) description!: string;
  @IsNumber() amount!: number;
}
class ChangeEventStatusDto {
  @IsIn(['submitted', 'approved', 'rejected']) status!: string;
}
class AccountingSyncDto {
  @IsString() @MinLength(1) @MaxLength(160) customerId!: string;
}
@Controller('v1/projects/:projectId/finance')
@UseGuards(KeycloakAuthGuard)
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly zohoBooks: ZohoBooksService,
  ) {}
  @Get() getControl(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.finance.getControl(request.actor!, projectId);
  }
  @Get('cost') getCostControl(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.finance.getCostControl(request.actor!, projectId);
  }
  @Get('invoices/:invoiceId') getInvoice(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.finance.getInvoice(request.actor!, projectId, invoiceId);
  }
  @Post('budgets') createBudget(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: BudgetDto,
  ) {
    return this.finance.createBudget(request.actor!, projectId, body);
  }
  @Post('commitments') createCommitment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: CommitmentDto,
  ) {
    return this.finance.createCommitment(request.actor!, projectId, body);
  }
  @Post('change-events') createChangeEvent(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: ChangeEventDto,
  ) {
    return this.finance.createChangeEvent(request.actor!, projectId, body);
  }
  @Post('change-events/:changeId/status') transitionChangeEvent(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('changeId') changeId: string,
    @Body() body: ChangeEventStatusDto,
  ) {
    return this.finance.transitionChangeEvent(request.actor!, projectId, changeId, body.status);
  }
  @Post('phases') createPhase(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: PhaseDto,
  ) {
    return this.finance.createPhase(request.actor!, projectId, body);
  }
  @Post('allocations') createAllocation(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: AllocationDto,
  ) {
    return this.finance.createAllocation(request.actor!, projectId, body);
  }
  @Post('time') createTime(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: TimeDto,
  ) {
    return this.finance.createTimeEntry(request.actor!, projectId, body);
  }
  @Post('time/:entryId/status') transitionTime(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('entryId') entryId: string,
    @Body() body: TimeStatusDto,
  ) {
    return this.finance.transitionTimeEntry(request.actor!, projectId, entryId, body.status);
  }
  @Post('invoices') createInvoice(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: InvoiceDto,
  ) {
    return this.finance.createInvoice(request.actor!, projectId, body);
  }
  @Post('invoices/:invoiceId/status') transitionInvoice(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: InvoiceStatusDto,
  ) {
    return this.finance.transitionInvoice(request.actor!, projectId, invoiceId, body.status);
  }
  @Post('invoices/:invoiceId/payments') createPayment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: PaymentDto,
  ) {
    return this.finance.recordPayment(request.actor!, projectId, invoiceId, body);
  }
  @Post('invoices/:invoiceId/accounting-sync') syncInvoice(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: AccountingSyncDto,
  ) {
    return this.zohoBooks.syncInvoice(request.actor!, projectId, invoiceId, body.customerId);
  }
}
