import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CasbinEnforcerService } from '../../infra/abac/casbin-enforcer.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';

const CLEARANCE_RANK: Record<string, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2 };

/**
 * Tập trung kiểm tra quyền cấp dự án/tài liệu cho module Documents:
 * - thành viên dự án (xem), Contributor/PM (sửa/upload),
 * - guard dự án ARCHIVED (read-only), clearance vs security_level (download).
 */
@Injectable()
export class DocumentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casbin: CasbinEnforcerService,
  ) {}

  async isAdmin(userId: string): Promise<boolean> {
    const roles = await this.casbin.getRolesForUser(userId);
    return roles.includes('role_admin');
  }

  async getProjectRole(projectId: string, user: AuthenticatedUser): Promise<string | null> {
    if (await this.isAdmin(user.sub)) return 'ADMIN';
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    if (!project) throw new NotFoundException('Không tìm thấy dự án.');
    if (project.ownerId === user.sub) return 'PM';
    const m = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.sub } },
      select: { projectRole: true },
    });
    return m?.projectRole ?? null;
  }

  /** Bất kỳ thành viên dự án (hoặc owner/admin) — quyền xem. */
  async assertMember(projectId: string, user: AuthenticatedUser): Promise<string> {
    const role = await this.getProjectRole(projectId, user);
    if (!role) throw new ForbiddenException('Bạn không có quyền truy cập dự án này.');
    return role;
  }

  /** PM/CONTRIBUTOR/owner/admin — quyền upload/sửa/khóa. */
  async assertCanEdit(projectId: string, user: AuthenticatedUser): Promise<string> {
    const role = await this.assertMember(projectId, user);
    if (!['ADMIN', 'PM', 'CONTRIBUTOR'].includes(role)) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa tài liệu trong dự án này.');
    }
    return role;
  }

  /** Chặn mọi thao tác đột biến khi dự án ARCHIVED (Read-only). */
  async assertProjectActive(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
    if (!project) throw new NotFoundException('Không tìm thấy dự án.');
    if (project.status === 'ARCHIVED') {
      throw new ForbiddenException('Dự án đã đóng băng (Read-only). Không thể thay đổi tài liệu.');
    }
  }

  /** Zero-Trust ABAC tối thiểu: clearance của user phải >= security_level của tài liệu. */
  assertClearance(userClearance: string | undefined, securityLevel: string): void {
    const u = CLEARANCE_RANK[userClearance ?? 'INTERNAL'] ?? 1;
    const need = CLEARANCE_RANK[securityLevel] ?? 1;
    if (u < need) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài liệu này.');
    }
  }
}
