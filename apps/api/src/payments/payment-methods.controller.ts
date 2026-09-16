import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';
type AuthenticatedRequest = Request & { user: RequestUser; id?: string };
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}
  @Get() list() { return this.methods.list(); }
  @Post() @Permissions('settings.manage') create(@Body() input: CreatePaymentMethodDto, @Req() request: AuthenticatedRequest) { return this.methods.create(input, this.context(request)); }
  @Patch(':id') @Permissions('settings.manage') update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdatePaymentMethodDto, @Req() request: AuthenticatedRequest) { return this.methods.update(id, input, this.context(request)); }
  private context(request: AuthenticatedRequest) { return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id }; }
}
