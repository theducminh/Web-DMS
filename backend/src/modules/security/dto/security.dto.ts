import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class QueryAuditDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  // Keyset cursor: id thấp hơn nextCursor (lớn -> bé theo thời gian).
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsBooleanString()
  status?: string; // 'true'/'false'
}

export class ExportAuditDto {
  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;

  @IsIn(['CSV', 'PDF'])
  format!: 'CSV' | 'PDF';

  @IsOptional()
  @IsIn(['ALL', 'SECURITY_ONLY'])
  scope?: 'ALL' | 'SECURITY_ONLY' = 'ALL';
}

export class LockdownDto {
  @IsString()
  @MinLength(4)
  securityPin!: string;

  @IsString()
  @MinLength(10, { message: 'Vui lòng cung cấp lý do phong tỏa rõ ràng (>=10 ký tự).' })
  reason!: string;
}
