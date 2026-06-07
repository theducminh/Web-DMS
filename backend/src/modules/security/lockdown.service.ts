import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { RedisService } from '../../infra/cache/redis.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { AuthService } from '../auth/auth.service';
import { LockdownDto } from './dto/security.dto';

/**
 * Emergency Lockdown (Luồng 25 / FR-1.3.2).
 *  - Đặt cờ Redis `system:lockdown=true` (Lockdown503Guard sẽ chặn mọi request
 *    trả 503, trừ các IP trong LOCKDOWN_SAFE_IP).
 *  - Thu hồi toàn bộ phiên người dùng (giữ riêng phiên của Admin thực thi lệnh).
 *  - Audit non-repudiation.
 */
@Injectable()
export class LockdownService {
  constructor(
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async lockdown(
    dto: LockdownDto,
    admin: AuthenticatedUser,
    refreshTokenCookie: string | undefined,
    ip: string,
  ): Promise<{ status: 'LOCKED'; message: string }> {
    if (!process.env.EMERGENCY_PIN || dto.securityPin !== process.env.EMERGENCY_PIN) {
      await this.audit.log({
        action: 'LOCKDOWN',
        userId: admin.sub,
        ipAddress: ip,
        isSuccess: false,
        failReason: 'Sai mã PIN khẩn cấp',
      });
      throw new UnauthorizedException('Mã PIN khẩn cấp không chính xác.');
    }

    // Bật cờ phong tỏa (TTL = 1 giờ; có thể release thủ công sớm)
    await this.redis.client.set('system:lockdown', 'true', 'EX', 3600);

    // Giữ phiên admin thực thi lệnh — thu hồi mọi phiên khác (mọi user)
    const adminRefreshJti = await this.auth.getRefreshJti(refreshTokenCookie);
    const sessionKeys = await this.redis.client.keys('user:sessions:*');
    for (const key of sessionKeys) {
      const userId = key.substring('user:sessions:'.length);
      if (userId === admin.sub) {
        await this.auth.revokeAllExcept(userId, adminRefreshJti);
      } else {
        await this.auth.revokeAllSessions(userId);
      }
    }

    await this.audit.log({
      action: 'LOCKDOWN',
      userId: admin.sub,
      ipAddress: ip,
      isSuccess: true,
      metadata: { reason: dto.reason },
    });

    return {
      status: 'LOCKED',
      message:
        'Hệ thống đã lập tức phong tỏa diện rộng. Toàn bộ phiên người dùng (trừ phiên Admin hiện tại) đã bị vô hiệu hóa.',
    };
  }

  async release(admin: AuthenticatedUser, ip: string): Promise<{ message: string }> {
    const wasLocked = await this.redis.client.get('system:lockdown');
    if (!wasLocked) throw new BadRequestException('Hệ thống đang không trong trạng thái phong tỏa.');
    await this.redis.client.del('system:lockdown');
    await this.audit.log({ action: 'LOCKDOWN_RELEASE', userId: admin.sub, ipAddress: ip, isSuccess: true });
    return { message: 'Đã gỡ phong tỏa. Hệ thống trở lại trạng thái hoạt động bình thường.' };
  }

  async getStatus(): Promise<{ locked: boolean }> {
    const v = await this.redis.client.get('system:lockdown');
    return { locked: v === 'true' };
  }
}
