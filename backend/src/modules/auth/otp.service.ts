import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/cache/redis.service';

/**
 * Sinh & xác thực OTP 6 chữ số, lưu Redis với TTL (mặc định 300s).
 * Key dạng: otp:<purpose>:<email>  (VD: otp:register:..., otp:forgot:...).
 */
@Injectable()
export class OtpService {
  private readonly ttl = Number(process.env.OTP_TTL_SECONDS ?? 300);

  constructor(private readonly redis: RedisService) {}

  private key(purpose: string, email: string): string {
    return `otp:${purpose}:${email.toLowerCase()}`;
  }

  async generate(purpose: string, email: string): Promise<{ otp: string; expiresIn: number }> {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.client.set(this.key(purpose, email), otp, 'EX', this.ttl);
    return { otp, expiresIn: this.ttl };
  }

  /** Trả về true nếu OTP đúng; xóa key sau khi khớp (one-time use). */
  async verify(purpose: string, email: string, otp: string): Promise<boolean> {
    const k = this.key(purpose, email);
    const stored = await this.redis.client.get(k);
    if (!stored || stored !== otp) return false;
    await this.redis.client.del(k);
    return true;
  }
}
