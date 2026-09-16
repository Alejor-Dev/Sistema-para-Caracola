import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/request-user';
import { Permissions } from '../iam/permissions.decorator';
import { AdjustInventoryDto, InventoryQueryDto, MovementQueryDto } from './inventory.dto';
import { InventoryService } from './inventory.service';

type AuthenticatedRequest = Request & { user: RequestUser; id?: string };

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get() @Permissions('inventory.read')
  list(@Query() query: InventoryQueryDto) { return this.inventory.list(query); }

  @Get('movements') @Permissions('inventory.view_history')
  movements(@Query() query: MovementQueryDto) { return this.inventory.movements(query); }

  @Post('adjustments') @Permissions('inventory.adjust')
  adjust(@Body() input: AdjustInventoryDto, @Req() request: AuthenticatedRequest) { return this.inventory.adjust(input, { actor: request.user, ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id }); }
}
