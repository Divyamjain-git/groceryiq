import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { BatchesModule } from './batches/batches.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, ProductsModule, SuppliersModule, BatchesModule, PurchaseOrdersModule, AuthModule],
})
export class AppModule {}
