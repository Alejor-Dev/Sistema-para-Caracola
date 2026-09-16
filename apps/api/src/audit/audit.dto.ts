import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
export class AuditQueryDto{
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page=1;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=30;
  @IsOptional() @IsString() @Length(1,120) action?:string;
  @IsOptional() @IsString() @Length(1,100) entityType?:string;
  @IsOptional() @IsUUID('4') actorUserId?:string;
  @IsOptional() @IsString() @Length(1,120) search?:string;
  @IsOptional() @IsDateString() from?:string;
  @IsOptional() @IsDateString() to?:string;
}
