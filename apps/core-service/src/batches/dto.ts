export class CreateBatchDto {
  productId!: string;
  supplierId?: string;
  quantity!: number;
  expiryDate?: string; // ISO date string, e.g. "2026-09-01"
  costPerUnitCents!: number;
}

export class UpdateBatchDto {
  quantity?: number;
  expiryDate?: string;
  costPerUnitCents?: number;
}
