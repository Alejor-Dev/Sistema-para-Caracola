import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @Length(2, 120)
  displayName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Length(12, 256)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'La contraseña debe incluir mayúscula, minúscula y número.' })
  password!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  roleIds!: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

export class ResetPasswordDto {
  @IsString()
  @Length(12, 256)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'La contraseña debe incluir mayúscula, minúscula y número.' })
  newPassword!: string;
}
