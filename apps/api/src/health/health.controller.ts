import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async getHealth(): Promise<{ status: string; database: string; version: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok', version: process.env.npm_package_version ?? '0.1.0' };
    } catch {
      throw new ServiceUnavailableException('La base de datos no está disponible.');
    }
  }
}
