import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString() @Length(2, 80) code!: string;
  @IsString() @Length(2, 120) name!: string;
}

export class UpdatePaymentMethodDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
