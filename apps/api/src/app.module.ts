import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { PermissionsGuard } from './iam/permissions.guard';
import { IamModule } from './iam/iam.module';
import { SetupModule } from './setup/setup.module';
import { CatalogModule } from './catalog/catalog.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CustomersModule } from './customers/customers.module';
import { PaymentsModule } from './payments/payments.module';
import { SalesModule } from './sales/sales.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReturnsModule } from './returns/returns.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportsModule } from './reports/reports.module';
import { ImportsModule } from './imports/imports.module';
import { OperationsModule } from './operations/operations.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    IamModule,
    SetupModule,
    CatalogModule,
    ProductsModule,
    InventoryModule,
    SuppliersModule,
    CustomersModule,
    PaymentsModule,
    SalesModule,
    PurchasesModule,
    ReturnsModule,
    RealtimeModule,
    ReportsModule,
    ImportsModule,
    OperationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
