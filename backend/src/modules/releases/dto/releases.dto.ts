import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateReleaseDto {
  @IsString()
  @MinLength(2, { message: 'Tên đợt phát hành quá ngắn.' })
  releaseName!: string;

  // Mã template quy chuẩn để chấm tuân thủ (VD: SOFTWARE_DEV). Bỏ trống = không chấm.
  @IsOptional()
  @IsString()
  templateType?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
