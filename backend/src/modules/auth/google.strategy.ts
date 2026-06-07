import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

/**
 * Google OAuth2 strategy. Trả về email + tên; việc kiểm tra domain tập đoàn và
 * tra cứu tài khoản được thực hiện ở AuthService.googleLogin (FR-1.1.2).
 * Nếu chưa cấu hình GOOGLE_CLIENT_ID, dùng giá trị placeholder để không crash boot;
 * route SSO chỉ hoạt động khi đã cấu hình thật.
 */
export const googleSsoConfigured = (): boolean => Boolean(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || 'http://localhost/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback): void {
    const email = profile.emails?.[0]?.value;
    done(null, { email, name: profile.displayName });
  }
}
