import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
const MONEY = /^\d{1,15}(\.\d{1,4})?$/;
export class ReturnLineDto { @IsUUID('4') saleItemId!: string; @IsInt() @Min(1) @Max(10000) quantity!: number; }
export class ExchangeLineDto { @IsUUID('4') variantId!: string; @IsInt() @Min(1) @Max(10000) quantity!: number; }
export class SettlementDto { @IsUUID('4') paymentMethodId!: string; @IsIn(['COLLECTION', 'REFUND']) type!: 'COLLECTION' | 'REFUND'; @Matches(MONEY) amount!: string; @IsOptional() @IsString() @Length(1, 160) reference?: string; }
export class CreateReturnDto {
  @IsString() @Length(8, 120) idempotencyKey!: string;
  @IsUUID('4') saleId!: string;
  @IsIn(['RETURN', 'EXCHANGE']) type!: 'RETURN' | 'EXCHANGE';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) items!: ReturnLineDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ExchangeLineDto) exchangeItems?: ExchangeLineDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => SettlementDto) settlements?: SettlementDto[];
  @IsString() @Length(4, 500) reason!: string;
  @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}
