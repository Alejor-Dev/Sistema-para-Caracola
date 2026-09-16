import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from './permissions.decorator';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './user.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users.read')
  list() {
    return this.users.list();
  }

  @Post()
  @Permissions('users.manage')
  create(@Body() input: CreateUserDto, @Req() request: AuthenticatedRequest) {
    return this.users.create(input, this.context(request));
  }

  @Patch(':id')
  @Permissions('users.manage')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateUserDto, @Req() request: AuthenticatedRequest) {
    return this.users.update(id, input, this.context(request));
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('users.manage')
  archive(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.users.archive(id, this.context(request));
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  @Permissions('users.manage')
  resetPassword(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: ResetPasswordDto, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.users.resetPassword(id, input, this.context(request));
  }

  private context(request: AuthenticatedRequest) {
    return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id };
  }
}
