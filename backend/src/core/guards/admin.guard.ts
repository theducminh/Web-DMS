import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CasbinEnforcerService } from '../../infra/abac/casbin-enforcer.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Chỉ cho phép System Admin truy cập. Xác định qua Casbin grouping policy:
 *   g, <userId>, role_admin
 * Hoạt động độc lập với cờ ABAC_ENABLED (luôn truy vấn enforcer đã nạp policy).
 * Áp dụng ở cấp controller: @UseGuards(AdminGuard) — chạy sau JwtAuthGuard toàn cục.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly casbin: CasbinEnforcerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này.');
    }
    const roles = await this.casbin.getRolesForUser(user.sub);
    if (!roles.includes('role_admin')) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này.');
    }
    return true;
  }
}
