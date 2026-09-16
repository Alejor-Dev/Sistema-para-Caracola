import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateSupplierDto {
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsString() @Length(1, 180) companyName?: string;
  @IsOptional() @IsString() @Length(5, 30) taxId?: string;
  @IsOptional() @IsString() @Length(5, 50) phone?: string;
  @IsOptional() @IsString() @Length(5, 50) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(2, 300) address?: string;
  @IsOptional() @IsString() @Length(0, 2000) notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() @Length(2, 160) name?: string;
  @IsOptional() @IsString() @Length(1, 180) companyName?: string;
  @IsOptional() @IsString() @Length(5, 30) taxId?: string;
  @IsOptional() @IsString() @Length(5, 50) phone?: string;
  @IsOptional() @IsString() @Length(5, 50) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(2, 300) address?: string;
  @IsOptional() @IsString() @Length(0, 2000) notes?: string;
}
