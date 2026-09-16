import { IsBoolean, IsHexColor, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export const CATALOG_TYPES = ['categories', 'subcategories', 'brands', 'colors', 'sizes', 'materials', 'genders', 'garment-types', 'seasons', 'collections'] as const;
export type CatalogType = typeof CATALOG_TYPES[number];

export class CreateCatalogItemDto {
  @IsString() @Length(1, 120)
  name!: string;

  @IsString() @Length(1, 80) @Matches(/^[a-z0-9._-]+$/)
  code!: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsUUID('4')
  categoryId?: string;

  @IsOptional() @IsHexColor()
  hexCode?: string;
}

export class UpdateCatalogItemDto {
  @IsOptional() @IsString() @Length(1, 120)
  name?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsHexColor()
  hexCode?: string;
}

export class CatalogTypeParamDto {
  @IsIn(CATALOG_TYPES)
  type!: CatalogType;
}
