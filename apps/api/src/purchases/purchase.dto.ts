import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { PaymentInputDto } from '../sales/sale.dto';
const MONEY = /^\d{1,15}(\.\d{1,4})?$/;
export class PurchaseItemInputDto { @IsUUID('4') variantId!: string; @IsInt() @Min(1) @Max(100000) quantity!: number; @Matches(MONEY) unitCostAmount!: string; }
export class CreatePurchaseDto {
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsUUID('4') supplierId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PurchaseItemInputDto) items!: PurchaseItemInputDto[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PaymentInputDto) payments!: PaymentInputDto[];
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}
export class PurchaseQueryDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 30; @IsOptional() @IsUUID('4') supplierId?: string; }
