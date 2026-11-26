import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// All routes require a valid JWT. Reads are open to any logged-in role
// (owner/manager/cashier); writes are restricted to owner/manager.
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query('storeId') storeId: string) {
    return this.productsService.findAll(storeId);
  }

  @Get('expiring')
  findExpiringSoon(
    @Query('storeId') storeId: string,
    @Query('withinDays') withinDays = '7',
  ) {
    return this.productsService.findExpiringSoon(storeId, Number(withinDays));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('OWNER', 'MANAGER')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }
}
