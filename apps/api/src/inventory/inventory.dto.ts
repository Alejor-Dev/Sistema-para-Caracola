import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, NotEquals } from 'class-validator';

export class AdjustInventoryDto {
  @IsUUID('4') variantId!: string;
  @IsInt() @NotEquals(0) quantityDelta!: number;
  @IsIn(['INITIAL', 'PURCHASE', 'ADJUSTMENT', 'LOSS', 'DAMAGED', 'CORRECTION'])
  type!: 'INITIAL' | 'PURCHASE' | 'ADJUSTMENT' | 'LOSS' | 'DAMAGED' | 'CORRECTION';
  @IsString() @Length(2, 80) reasonCode!: string;
  @IsOptional() @IsString() @Length(2, 1000) notes?: string;
}

export class InventoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsIn(['all', 'low', 'out']) status: 'all' | 'low' | 'out' = 'all';
}

export class MovementQueryDto {
  @IsOptional() @IsUUID('4') variantId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
}
