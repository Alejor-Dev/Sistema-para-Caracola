import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

const MONEY = /^\d{1,15}(\.\d{1,4})?$/;

export class SaleItemInputDto {
  @IsUUID('4') variantId!: string;
  @IsInt() @Min(1) @Max(10000) quantity!: number;
  @IsOptional() @Matches(MONEY) discountAmount?: string;
}

export class PaymentInputDto {
  @IsUUID('4') paymentMethodId!: string;
  @Matches(MONEY) amount!: string;
  @IsOptional() @IsString() @Length(1, 160) reference?: string;
}

export class CreateSaleDto {
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsOptional() @IsUUID('4') customerId?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SaleItemInputDto) items!: SaleItemInputDto[];
  @IsOptional() @Matches(MONEY) discountAmount?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PaymentInputDto) payments!: PaymentInputDto[];
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}

export class SaleQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 30;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsUUID('4') customerId?: string;
}

export class CatalogQueryDto {
  @IsString() @Length(1, 120) search!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
}

export class VoidSaleDto { @IsString() @Length(4, 500) reason!: string; }
