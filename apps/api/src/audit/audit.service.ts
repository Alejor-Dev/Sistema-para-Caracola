import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './audit.dto';

export interface AuditInput {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({ data: input });
  }

  async list(query:AuditQueryDto){
    const where:Prisma.AuditLogWhereInput={
      action:query.action?{contains:query.action,mode:'insensitive'}:undefined,entityType:query.entityType?{contains:query.entityType,mode:'insensitive'}:undefined,actorUserId:query.actorUserId,
      occurredAt:query.from||query.to?{gte:query.from?new Date(`${query.from}T00:00:00-03:00`):undefined,lte:query.to?new Date(`${query.to}T23:59:59.999-03:00`):undefined}:undefined,
      ...(query.search?{OR:[{action:{contains:query.search,mode:'insensitive'}},{entityType:{contains:query.search,mode:'insensitive'}},{entityId:{contains:query.search,mode:'insensitive'}},{requestId:{contains:query.search,mode:'insensitive'}},{actor:{is:{displayName:{contains:query.search,mode:'insensitive'}}}}]}:{}),
    };
    const [total,data]=await this.prisma.$transaction([this.prisma.auditLog.count({where}),this.prisma.auditLog.findMany({where,skip:(query.page-1)*query.pageSize,take:query.pageSize,orderBy:[{occurredAt:'desc'},{id:'desc'}],include:{actor:{select:{id:true,displayName:true,username:true}}}})]);
    return{data,pagination:{page:query.page,pageSize:query.pageSize,total,pages:Math.ceil(total/query.pageSize)}};
  }
}
