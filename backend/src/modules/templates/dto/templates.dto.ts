import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(3, { message: 'Tên template quá ngắn.' })
  name!: string;

  // Mã định danh template (UPPER_SNAKE_CASE) — dùng làm khóa logic khi tạo dự án.
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]+$/, { message: 'templateType phải UPPER_SNAKE_CASE (VD: SOFTWARE_DEV).' })
  templateType!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTemplateStatusDto {
  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}

export class CreateTemplateFolderDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // ID của folder cha (cùng template). Bỏ trống = thư mục gốc (parent_path NULL).
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class UpdateTemplateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}
