import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll(storeId: string) {
    return this.prisma.product.findMany({ where: { storeId } });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id); // 404s if missing
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  // Batches with the earliest expiry date first — this is what POS checkout
  // calls to pick which batch to deduct from (FEFO rotation).
  async findOldestBatch(productId: string) {
    return this.prisma.batch.findFirst({
      where: { productId, quantity: { gt: 0 } },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async findExpiringSoon(storeId: string, withinDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return this.prisma.batch.findMany({
      where: {
        expiryDate: { lte: cutoff },
        product: { storeId },
        quantity: { gt: 0 },
      },
      include: { product: true },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
