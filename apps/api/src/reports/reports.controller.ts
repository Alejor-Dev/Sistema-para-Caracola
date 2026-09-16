import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { ExportReportDto, ReportRangeDto } from './report.dto';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('dashboard') @Permissions('reports.read') dashboard(@Req() request: AuthenticatedRequest) { return this.reports.dashboard(request.user); }
  @Get('summary') @Permissions('reports.read') summary(@Query() query: ReportRangeDto, @Req() request: AuthenticatedRequest) { return this.reports.summary(query, request.user); }
  @Get('inventory') @Permissions('reports.read') inventory(@Req() request: AuthenticatedRequest) { return this.reports.inventory(request.user); }
  @Get('export') @Permissions('reports.read','exports.create') async export(@Query() query: ExportReportDto, @Req() request: AuthenticatedRequest, @Res() response: Response) {
    const result = await this.reports.export(query, { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id });
    response.setHeader('content-type', result.contentType); response.setHeader('content-disposition', `attachment; filename="${query.dataset}-${new Date().toISOString().slice(0,10)}.${result.extension}"`); response.setHeader('x-exported-rows', String(result.rows)); response.send(result.buffer);
  }
}
