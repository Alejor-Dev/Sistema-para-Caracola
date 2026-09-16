import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/public.decorator';
import { InitializeAdminDto } from './initialize-admin.dto';
import { SetupService } from './setup.service';

@Public()
@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('status')
  status() {
    return this.setup.status();
  }

  @Post('initialize')
  initialize(@Body() input: InitializeAdminDto, @Req() request: Request & { id?: string }) {
    return this.setup.initialize(input, { ip: request.ip, userAgent: request.get('user-agent'), requestId: request.id });
  }
}
