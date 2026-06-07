import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const STRONG_PASSWORD_MSG =
  'Mật khẩu phải >= 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';

/**
 * Cổng xác thực danh tính trước khi sửa hồ sơ (FR-1.2.3):
 *  - LOCAL: type=PASSWORD, value=mật khẩu hiện tại
 *  - GOOGLE: type=OTP, value=mã OTP gửi qua email công ty
 */
export class AuthContextDto {
  @IsIn(['PASSWORD', 'OTP'], { message: 'Loại xác thực không hợp lệ.' })
  type!: 'PASSWORD' | 'OTP';

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập thông tin xác thực.' })
  value!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Họ tên quá ngắn.' })
  fullName?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh không hợp lệ.' })
  dob?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'], { message: 'Giới tính không hợp lệ.' })
  gender?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Số điện thoại không hợp lệ.' })
  phone?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AuthContextDto)
  authContext!: AuthContextDto;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu hiện tại.' })
  currentPassword!: string;

  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MSG })
  newPassword!: string;
}
