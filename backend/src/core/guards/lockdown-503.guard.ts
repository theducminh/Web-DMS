import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../infra/cache/redis.service';

/**
 * [Luồng 25] Emergency Lockdown. Khi cờ Redis `system:lockdown = true`, Guard tối cao
 * này chặn TOÀN BỘ request (HTTP 503), trừ các IP an toàn (LOCKDOWN_SAFE_IP) để Admin
 * phát lệnh / DevOps gỡ phong tỏa vẫn thao tác được. Đặt ở vị trí đầu chuỗi Guard.
 */
@Injectable()
export class Lockdown503Guard implements CanActivate {
  private readonly safeIps: string[] = (process.env.LOCKDOWN_SAFE_IP ?? '127.0.0.1')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const locked = await this.redis.client.get('system:lockdown');
    if (locked !== 'true') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const ip = (request.ip ?? '').replace('::ffff:', '');
    if (this.safeIps.includes(ip)) return true;

    throw new ServiceUnavailableException(
      'Hệ thống đang trong trạng thái phong tỏa khẩn cấp. Vui lòng thử lại sau.',
    );
  }
}
