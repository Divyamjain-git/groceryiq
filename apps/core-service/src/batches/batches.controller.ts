import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { CreateBatchDto, UpdateBatchDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  findAllForProduct(@Query('productId') productId: string) {
    return this.batchesService.findAllForProduct(productId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }

  @Post()
  @Roles('OWNER', 'MANAGER')
  create(@Body() dto: CreateBatchDto) {
    return this.batchesService.create(dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.batchesService.update(id, dto);
  }
}
