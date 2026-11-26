import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderStatusDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER') // whole resource is manager+ only — cashiers don't touch ordering
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  findAll(@Query('storeId') storeId: string) {
    return this.purchaseOrdersService.findAll(storeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderStatusDto) {
    return this.purchaseOrdersService.updateStatus(id, dto);
  }
}
