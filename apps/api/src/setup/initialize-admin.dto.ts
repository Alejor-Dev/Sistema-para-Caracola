import { IsString, Length, Matches } from 'class-validator';

export class InitializeAdminDto {
  @IsString()
  @Length(2, 120)
  displayName!: string;

  @IsString()
  @Length(3, 80)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @Length(12, 256)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'La contraseña debe incluir mayúscula, minúscula y número.' })
  password!: string;
}
