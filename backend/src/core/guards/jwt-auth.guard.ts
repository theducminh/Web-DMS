import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RedisService } from '../../infra/cache/redis.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Xác thực JWT Access Token. Token lấy từ header `Authorization: Bearer ...`
 * hoặc HttpOnly cookie `access_token`. Kiểm tra Blacklist trên Redis (Force Logout /
 * Refresh Token Rotation) để vô hiệu hóa phiên tức thời theo mô hình Zero-Trust.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Yêu cầu đăng nhập.');
    }

    let payload: AuthenticatedUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }

    // Blacklist check: nếu jti đã bị thu hồi -> chặn ngay
    if (payload.jti) {
      const revoked = await this.redis.client.get(`blacklist:${payload.jti}`);
      if (revoked) {
        throw new UnauthorizedException('Phiên làm việc đã bị thu hồi. Vui lòng đăng nhập lại.');
      }
    }

    (request as any).user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const cookies = (request as any).cookies as Record<string, string> | undefined;
    return cookies?.['access_token'];
  }
}
