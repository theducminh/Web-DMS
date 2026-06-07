import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';
import { GoogleStrategy } from './google.strategy';

/**
 * AuthModule [Luồng 1, 2, 3] — Xác thực nội bộ, Google SSO, JWT + Refresh rotation,
 * OTP đăng ký/khôi phục, quản lý phiên qua Redis.
 * (PrismaService/RedisService/CasbinEnforcer từ InfraModule, JwtService/AuditService
 *  từ CoreModule — đều Global nên không cần import lại.)
 */
@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, MailService, GoogleStrategy],
  exports: [AuthService, OtpService, MailService],
})
export class AuthModule {}
