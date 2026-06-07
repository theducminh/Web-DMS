import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

// Mật khẩu mạnh (FR-1.2.1): >=8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const STRONG_PASSWORD_MSG =
  'Mật khẩu phải >= 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu.' })
  password!: string;
}

export class RegisterRequestDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  @MinLength(2, { message: 'Họ tên quá ngắn.' })
  fullName!: string;

  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh không hợp lệ.' })
  dob?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'], { message: 'Giới tính không hợp lệ.' })
  gender?: string;

  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MSG })
  password!: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số.' })
  otp!: string;
}

export class ForgotPasswordRequestDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;
}

export class ResetPasswordConfirmDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số.' })
  otp!: string;

  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MSG })
  newPassword!: string;
}
