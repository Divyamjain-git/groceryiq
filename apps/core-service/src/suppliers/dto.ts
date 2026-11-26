export class CreateSupplierDto {
  storeId!: string;
  name!: string;
  contactInfo?: string;
}

export class UpdateSupplierDto {
  name?: string;
  contactInfo?: string;
}
