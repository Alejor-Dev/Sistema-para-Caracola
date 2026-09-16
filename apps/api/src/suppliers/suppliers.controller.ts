import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { CreateSupplierDto, UpdateSupplierDto } from './supplier.dto';
import { SuppliersService } from './suppliers.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}
  @Get() @Permissions('products.read') list(@Query('search') search?: string) { return this.suppliers.list(search); }
  @Post() @Permissions('suppliers.manage') create(@Body() input: CreateSupplierDto, @Req() request: AuthenticatedRequest) { return this.suppliers.create(input, this.context(request)); }
  @Patch(':id') @Permissions('suppliers.manage') update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateSupplierDto, @Req() request: AuthenticatedRequest) { return this.suppliers.update(id, input, this.context(request)); }
  @Delete(':id') @HttpCode(204) @Permissions('suppliers.manage') archive(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) { return this.suppliers.archive(id, this.context(request)); }
  private context(request: AuthenticatedRequest) { return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id }; }
}
