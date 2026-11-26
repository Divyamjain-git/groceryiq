export class PurchaseOrderItemInput {
  productId!: string;
  quantity!: number;
  unitCostCents!: number;
}

export class CreatePurchaseOrderDto {
  storeId!: string;
  supplierId!: string;
  expectedDelivery?: string; // ISO date string
  items!: PurchaseOrderItemInput[];
}

export class UpdatePurchaseOrderStatusDto {
  status!: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
}
