// Plain DTOs for now. Once auth is wired up (Week 2), add class-validator
// decorators here (@IsString, @IsInt, etc.) and enable ValidationPipe
// globally in main.ts.

export class CreateProductDto {
  storeId!: string;
  sku!: string;
  name!: string;
  category!: string;
  unit!: string;
  reorderPoint!: number;
  unitCostCents!: number;
  unitPriceCents!: number;
}

export class UpdateProductDto {
  name?: string;
  category?: string;
  unit?: string;
  reorderPoint?: number;
  unitCostCents?: number;
  unitPriceCents?: number;
}
