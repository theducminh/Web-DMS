import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { POLICY_ACTION_KEY } from '../decorators/check-policy.decorator';
import { CasbinEnforcerService } from '../../infra/abac/casbin-enforcer.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Phân quyền ABAC/RBAC qua Casbin. Subject = userId, Object = đường dẫn API,
 * Action = HTTP method (hoặc @CheckPolicy ghi đè). Default Deny (FR-4.1.3).
 *
 * Bật/tắt bằng env ABAC_ENABLED (mặc định false để dev tăng dần policy mà không bị
 * khóa toàn cục). Khi bật, mọi route không-Public đều phải khớp một luật ALLOW.
 * Thông báo từ chối luôn chung chung (FR-4.2.1) — không tiết lộ luật bị chặn.
 */
@Injectable()
export class CasbinAbacGuard implements CanActivate {
  private readonly logger = new Logger(CasbinAbacGuard.name);
  private readonly enabled = process.env.ABAC_ENABLED === 'true';

  constructor(
    private readonly reflector: Reflector,
    private readonly casbin: CasbinEnforcerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !this.enabled) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này.');
    }

    const action =
      this.reflector.getAllAndOverride<string>(POLICY_ACTION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? request.method;

    const resource = request.baseUrl + (request.path ?? '');

    const allowed = await this.casbin.enforce(user.sub, resource, action);
    if (!allowed) {
      // Ghi nhận từ chối ở tầng service/interceptor; ở đây trả lỗi chung chung.
      this.logger.warn(`ABAC DENY user=${user.sub} ${action} ${resource}`);
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này.');
    }
    return true;
  }
}
