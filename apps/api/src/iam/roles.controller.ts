import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from './permissions.decorator';
import { CreateRoleDto, UpdateRoleDto } from './role.dto';
import { RolesService } from './roles.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions('users.read')
  list() {
    return this.roles.list();
  }

  @Get('permissions')
  @Permissions('roles.manage')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Post()
  @Permissions('roles.manage')
  create(@Body() input: CreateRoleDto, @Req() request: AuthenticatedRequest) {
    return this.roles.create(input, this.context(request));
  }

  @Patch(':id')
  @Permissions('roles.manage')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateRoleDto, @Req() request: AuthenticatedRequest) {
    return this.roles.update(id, input, this.context(request));
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('roles.manage')
  archive(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest): Promise<void> {
    return this.roles.archive(id, this.context(request));
  }

  private context(request: AuthenticatedRequest) {
    return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id };
  }
}
