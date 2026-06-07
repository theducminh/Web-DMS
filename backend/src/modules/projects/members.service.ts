import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infra/database/prisma.service';
import { CasbinEnforcerService } from '../../infra/abac/casbin-enforcer.service';
import { RedisService } from '../../infra/cache/redis.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ProjectsService } from './projects.service';
import { AddMemberDto, UpdateMemberDto } from './dto/projects.dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casbin: CasbinEnforcerService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly projects: ProjectsService,
  ) {}

  // --- Luồng 13 (B1): Tìm nhân sự có thể thêm vào dự án (PM-only — không cần admin) ---
  // Loại trừ user đã thuộc project. PM (assertManager) hoặc Admin (isAdmin) đều gọi được.
  async searchable(projectId: string, query: string, user: AuthenticatedUser, limit = 15) {
    await this.projects.assertManager(projectId, user);

    const existingMemberIds = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const excludeIds = existingMemberIds.map((m) => m.userId);

    const where: any = {
      status: 'ACTIVE',
      id: { notIn: excludeIds.length > 0 ? excludeIds : ['00000000-0000-0000-0000-000000000000'] },
    };
    if (query && query.trim().length > 0) {
      const q = query.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.profile.findMany({
      where,
      take: Math.min(limit, 50),
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        title: true,
        department: { select: { name: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      title: r.title,
      department: r.department?.name ?? null,
    }));
  }

  // --- Luồng 13: Danh sách thành viên ---
  async list(projectId: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { assignedAt: 'asc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, department: { select: { name: true } } },
        },
      },
    });
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    return members.map((m) => ({
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      department: m.user.department?.name ?? null,
      projectRole: m.projectRole,
      isOwner: m.userId === project?.ownerId,
      assignedAt: m.assignedAt,
    }));
  }

  // --- Luồng 13: Thêm thành viên ---
  async add(projectId: string, dto: AddMemberDto, user: AuthenticatedUser) {
    await this.projects.assertManager(projectId, user);

    const exists = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (exists) throw new BadRequestException('Nhân sự đã có trong dự án.');

    const profile = await this.prisma.profile.findUnique({ where: { id: dto.userId }, select: { id: true } });
    if (!profile) throw new NotFoundException('Không tìm thấy nhân sự.');

    await this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, projectRole: dto.projectRole },
    });
    await this.casbin.addGroupingPolicy(dto.userId, this.projects.roleName(projectId, dto.projectRole));
    await this.evictAbac(dto.userId);

    await this.audit.log({
      action: 'PROJECT_MEMBER_ADD',
      userId: user.sub,
      targetId: projectId,
      isSuccess: true,
      metadata: { addedUser: dto.userId, role: dto.projectRole },
    });
    return { message: 'Đã thêm nhân sự vào đội ngũ dự án.' };
  }

  // --- Luồng 13: Đổi vai trò (đồng bộ Casbin grouping) ---
  async update(projectId: string, targetUserId: string, dto: UpdateMemberDto, user: AuthenticatedUser) {
    await this.projects.assertManager(projectId, user);

    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    if (project?.ownerId === targetUserId) {
      throw new BadRequestException('Không thể đổi vai trò của PM Owner dự án.');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Nhân sự không thuộc dự án.');

    await this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      data: { projectRole: dto.projectRole },
    });

    // Casbin: gỡ grouping cũ, thêm grouping mới
    await this.casbin.removeGroupingPolicy(targetUserId, this.projects.roleName(projectId, member.projectRole));
    await this.casbin.addGroupingPolicy(targetUserId, this.projects.roleName(projectId, dto.projectRole));
    await this.evictAbac(targetUserId);

    await this.audit.log({
      action: 'PROJECT_MEMBER_UPDATE',
      userId: user.sub,
      targetId: projectId,
      isSuccess: true,
      metadata: { targetUser: targetUserId, before: member.projectRole, after: dto.projectRole },
    });
    return { message: 'Cập nhật vai trò thành công.' };
  }

  // --- Luồng 13: Xóa thành viên (gỡ grouping Casbin) ---
  async remove(projectId: string, targetUserId: string, user: AuthenticatedUser) {
    await this.projects.assertManager(projectId, user);

    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    if (project?.ownerId === targetUserId) {
      throw new BadRequestException('Không thể xóa PM Owner khỏi dự án.');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Nhân sự không thuộc dự án.');

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    await this.casbin.removeGroupingPolicy(targetUserId, this.projects.roleName(projectId, member.projectRole));
    await this.evictAbac(targetUserId);

    await this.audit.log({
      action: 'PROJECT_MEMBER_REMOVE',
      userId: user.sub,
      targetId: projectId,
      isSuccess: true,
      metadata: { removedUser: targetUserId },
    });
    return { message: 'Đã xóa nhân sự khỏi dự án.' };
  }

  // Thành viên/owner/admin mới được xem danh sách
  private async assertProjectAccess(projectId: string, user: AuthenticatedUser): Promise<void> {
    if (await this.projects.isAdmin(user.sub)) return;
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    if (!project) throw new NotFoundException('Không tìm thấy dự án.');
    if (project.ownerId === user.sub) return;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.sub } },
    });
    if (!membership) throw new ForbiddenException('Bạn không có quyền truy cập dự án này.');
  }

  private async evictAbac(userId: string): Promise<void> {
    await this.redis.client.del(`abac:cache:${userId}`);
  }
}
