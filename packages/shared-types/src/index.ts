// Shared types between core-service and web, so the frontend and API
// never drift out of sync on shape.

export interface Product {
  id: string;
  storeId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  reorderPoint: number;
  unitCostCents: number;
  unitPriceCents: number;
}

export interface Batch {
  id: string;
  productId: string;
  quantity: number;
  receivedDate: string;
  expiryDate: string | null;
  costPerUnitCents: number;
}

export type AlertType = "LOW_STOCK" | "EXPIRING_SOON" | "ANOMALY_DETECTED";

export interface Alert {
  id: string;
  storeId: string;
  type: AlertType;
  message: string;
  severity: string;
  resolved: boolean;
  createdAt: string;
}
