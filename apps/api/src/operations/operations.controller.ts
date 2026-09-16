import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../iam/permissions.decorator';
import { OperationsService } from './operations.service';

@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('backup-status')
  @Permissions('backups.manage')
  backupStatus() { return this.operations.backupStatus(); }
}
