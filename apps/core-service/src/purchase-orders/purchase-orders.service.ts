import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderStatusDto } from './dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  findAll(storeId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { storeId },
      include: { items: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, supplier: true },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    return po;
  }

  create(dto: CreatePurchaseOrderDto) {
    return this.prisma.purchaseOrder.create({
      data: {
        storeId: dto.storeId,
        supplierId: dto.supplierId,
        expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : undefined,
        status: 'DRAFT',
        items: { create: dto.items },
      },
      include: { items: true },
    });
  }

  async updateStatus(id: string, dto: UpdatePurchaseOrderStatusDto) {
    const po = await this.findOne(id);

    // When marking RECEIVED, actually create batches from the ordered
    // items so stock shows up. This is the real "restocking" moment.
    if (dto.status === 'RECEIVED' && po.status !== 'RECEIVED') {
      await this.prisma.$transaction(
        po.items.map((item) =>
          this.prisma.batch.create({
            data: {
              productId: item.productId,
              supplierId: po.supplierId,
              quantity: item.quantity,
              costPerUnitCents: item.unitCostCents,
            },
          }),
        ),
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
