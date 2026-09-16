import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CustomerQueryDto {
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 30;
}

export class CreateCustomerDto {
  @IsString() @Length(2, 120) firstName!: string;
  @IsOptional() @IsString() @Length(1, 120) lastName?: string;
  @IsOptional() @IsString() @Length(5, 30) documentId?: string;
  @IsOptional() @IsString() @Length(5, 50) phone?: string;
  @IsOptional() @IsString() @Length(5, 50) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(2, 300) address?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @Length(0, 2000) notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @Length(2, 120) firstName?: string;
  @IsOptional() @IsString() @Length(1, 120) lastName?: string;
  @IsOptional() @IsString() @Length(5, 30) documentId?: string;
  @IsOptional() @IsString() @Length(5, 50) phone?: string;
  @IsOptional() @IsString() @Length(5, 50) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(2, 300) address?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @Length(0, 2000) notes?: string;
}
