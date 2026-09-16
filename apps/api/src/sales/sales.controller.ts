import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { CatalogQueryDto, CreateSaleDto, SaleQueryDto, VoidSaleDto } from './sale.dto';
import { SalesService } from './sales.service';
type AuthenticatedRequest = Request & { user: RequestUser; id?: string };
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}
  @Get('catalog') @Permissions('sales.create') catalog(@Query() query: CatalogQueryDto) { return this.sales.catalog(query); }
  @Get() @Permissions('sales.read') list(@Query() query: SaleQueryDto) { return this.sales.list(query); }
  @Get(':id') @Permissions('sales.read') get(@Param('id', new ParseUUIDPipe()) id: string) { return this.sales.get(id); }
  @Post() @Permissions('sales.create') create(@Body() input: CreateSaleDto, @Req() request: AuthenticatedRequest) { return this.sales.create(input, this.context(request)); }
  @Post(':id/void') @Permissions('sales.void') void(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: VoidSaleDto, @Req() request: AuthenticatedRequest) { return this.sales.void(id, input.reason, this.context(request)); }
  private context(request: AuthenticatedRequest) { return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id }; }
}
