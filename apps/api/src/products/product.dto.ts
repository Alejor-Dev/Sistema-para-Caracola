import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { ProductStatus } from '@prisma/client';

const MONEY = /^\d{1,15}(\.\d{1,4})?$/;

export class CreateVariantDto {
  @IsString() @Length(1, 100)
  sku!: string;

  @IsOptional() @IsString() @Length(1, 100)
  barcode?: string;

  @IsOptional() @IsUUID('4')
  colorId?: string;

  @IsOptional() @IsUUID('4')
  sizeId?: string;

  @IsString() @Matches(MONEY)
  costAmount!: string;

  @IsString() @Matches(MONEY)
  salePriceAmount!: string;

  @IsOptional() @IsString() @Matches(MONEY)
  wholesalePriceAmount?: string;

  @IsOptional() @IsInt() @Min(0)
  minStockOverride?: number;

  @IsOptional() @IsInt() @Min(0)
  initialStock?: number;
}

export class CreateProductDto {
  @IsString() @Length(2, 180)
  name!: string;

  @IsOptional() @IsString() @Length(0, 3000)
  description?: string;

  @IsOptional() @IsUUID('4') categoryId?: string;
  @IsOptional() @IsUUID('4') subcategoryId?: string;
  @IsOptional() @IsUUID('4') brandId?: string;
  @IsOptional() @IsUUID('4') genderId?: string;
  @IsOptional() @IsUUID('4') garmentTypeId?: string;
  @IsOptional() @IsUUID('4') seasonId?: string;
  @IsOptional() @IsUUID('4') collectionId?: string;
  @IsOptional() @IsUUID('4') defaultSupplierId?: string;

  @IsOptional() @IsInt() @Min(0)
  minStock?: number;

  @IsOptional() @IsString() @Length(0, 3000)
  notes?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true })
  materialIds?: string[];

  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @Length(2, 180) name?: string;
  @IsOptional() @IsString() @Length(0, 3000) description?: string;
  @IsOptional() @IsUUID('4') categoryId?: string;
  @IsOptional() @IsUUID('4') subcategoryId?: string;
  @IsOptional() @IsUUID('4') brandId?: string;
  @IsOptional() @IsUUID('4') genderId?: string;
  @IsOptional() @IsUUID('4') garmentTypeId?: string;
  @IsOptional() @IsUUID('4') seasonId?: string;
  @IsOptional() @IsUUID('4') collectionId?: string;
  @IsOptional() @IsUUID('4') defaultSupplierId?: string;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsString() @Length(0, 3000) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) materialIds?: string[];
}

export class UpdateVariantDto {
  @IsOptional() @IsString() @Length(1, 100) barcode?: string;
  @IsOptional() @IsUUID('4') colorId?: string;
  @IsOptional() @IsUUID('4') sizeId?: string;
  @IsOptional() @IsString() @Matches(MONEY) costAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) salePriceAmount?: string;
  @IsOptional() @IsString() @Matches(MONEY) wholesalePriceAmount?: string;
  @IsOptional() @IsInt() @Min(0) minStockOverride?: number;
  @IsOptional() @IsIn(Object.values(ProductStatus)) status?: ProductStatus;
  @IsOptional() @IsString() @Length(2, 300) priceChangeReason?: string;
}

export class ProductQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsUUID('4') categoryId?: string;
  @IsOptional() @IsUUID('4') brandId?: string;
  @IsOptional() @IsUUID('4') colorId?: string;
  @IsOptional() @IsUUID('4') sizeId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() lowStock?: boolean;
  @IsOptional() @IsIn(['name-asc', 'name-desc', 'newest', 'oldest', 'stock-asc', 'stock-desc', 'price-asc', 'price-desc'])
  sort: string = 'newest';
}

export class PricingQueryDto {
  @IsString() @Matches(MONEY) cost!: string;
  @IsOptional() @IsString() @Matches(MONEY) price?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,4}(\.\d{1,2})?$/) markupPercent?: string;
}
