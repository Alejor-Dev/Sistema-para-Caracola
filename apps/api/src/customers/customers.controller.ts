import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './customer.dto';
import { CustomersService } from './customers.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get() @Permissions('customers.read') list(@Query() query: CustomerQueryDto) { return this.customers.list(query); }
  @Get(':id') @Permissions('customers.read') get(@Param('id', new ParseUUIDPipe()) id: string) { return this.customers.get(id); }
  @Post() @Permissions('customers.manage') create(@Body() input: CreateCustomerDto, @Req() request: AuthenticatedRequest) { return this.customers.create(input, this.context(request)); }
  @Patch(':id') @Permissions('customers.manage') update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateCustomerDto, @Req() request: AuthenticatedRequest) { return this.customers.update(id, input, this.context(request)); }
  @Delete(':id') @HttpCode(204) @Permissions('customers.manage') archive(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) { return this.customers.archive(id, this.context(request)); }
  private context(request: AuthenticatedRequest) { return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id }; }
}
