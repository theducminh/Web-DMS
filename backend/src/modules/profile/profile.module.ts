import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { SessionController } from './session.controller';
import { ProfileService } from './profile.service';

/**
 * ProfileModule [Luồng 5, 6] — Hồ sơ cá nhân, đổi mật khẩu, quản lý phiên.
 * Import AuthModule để dùng AuthService (session) + OtpService/MailService (OTP cho SSO).
 */
@Module({
  imports: [AuthModule],
  controllers: [ProfileController, SessionController],
  providers: [ProfileService],
})
export class ProfileModule {}
