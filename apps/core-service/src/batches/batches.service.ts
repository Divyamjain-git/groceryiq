import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto, UpdateBatchDto } from './dto';

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  findAllForProduct(productId: string) {
    return this.prisma.batch.findMany({
      where: { productId },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  create(dto: CreateBatchDto) {
    return this.prisma.batch.create({
      data: {
        ...dto,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateBatchDto) {
    await this.findOne(id);
    return this.prisma.batch.update({
      where: { id },
      data: {
        ...dto,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  // Same FEFO lookup used by ProductsService — this is the one POS
  // checkout should actually call when deducting stock on a sale.
  async findOldestAvailable(productId: string) {
    return this.prisma.batch.findFirst({
      where: { productId, quantity: { gt: 0 } },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
