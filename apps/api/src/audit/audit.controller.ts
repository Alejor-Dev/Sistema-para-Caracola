import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../iam/permissions.decorator';
import { AuditQueryDto } from './audit.dto';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions('audit.read')
  list(@Query() query:AuditQueryDto){return this.audit.list(query);}
}
