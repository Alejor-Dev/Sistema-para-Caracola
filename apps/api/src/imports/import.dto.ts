import { IsUUID } from 'class-validator';
export class ConfirmProductImportDto { @IsUUID('4') importId!: string; }
