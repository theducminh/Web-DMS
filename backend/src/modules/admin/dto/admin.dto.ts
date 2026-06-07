import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const USER_STATUS = ['PENDING', 'ACTIVE', 'DISABLED'] as const;
const CLEARANCE = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'] as const;

// --- Luồng 7: Query danh bạ user ---
export class QueryUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(USER_STATUS)
  status?: (typeof USER_STATUS)[number];
}

export class BulkStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  userIds!: string[];

  @IsIn(USER_STATUS)
  status!: (typeof USER_STATUS)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkAttributesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  userIds!: string[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

// --- Luồng 8: Gán thuộc tính ABAC cho 1 user ---
export class UpdateAttributesDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsIn(CLEARANCE)
  clearanceLevel!: (typeof CLEARANCE)[number];
}

// --- Luồng 9: Departments ---
export class CreateDepartmentDto {
  @IsString()
  @MinLength(2, { message: 'Tên phòng ban quá ngắn.' })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentStatusDto {
  @Type(() => Boolean)
  isActive!: boolean;
}
