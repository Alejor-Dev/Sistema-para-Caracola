import { Body, Controller, Get, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { CatalogTypeParamDto, CreateCatalogItemDto, UpdateCatalogItemDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };

@Controller('catalogs')
export class CatalogController {
  constructor(private readonly catalogs: CatalogService) {}

  @Get(':type') @Permissions('products.read')
  list(@Param() params: CatalogTypeParamDto, @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean) {
    return this.catalogs.list(params.type, includeInactive);
  }

  @Post(':type') @Permissions('products.create')
  create(@Param() params: CatalogTypeParamDto, @Body() input: CreateCatalogItemDto, @Req() request: AuthenticatedRequest) {
    return this.catalogs.create(params.type, input, this.context(request));
  }

  @Patch(':type/:id') @Permissions('products.update')
  update(@Param() params: CatalogTypeParamDto, @Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateCatalogItemDto, @Req() request: AuthenticatedRequest) {
    return this.catalogs.update(params.type, id, input, this.context(request));
  }

  private context(request: AuthenticatedRequest) { return { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id }; }
}
