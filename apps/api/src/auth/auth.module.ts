import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './session-auth.guard';

@Module({ imports: [AuditModule], controllers: [AuthController], providers: [AuthService, SessionAuthGuard], exports: [AuthService] })
export class AuthModule {}
