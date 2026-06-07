import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/database/prisma.service';
import { CasbinEnforcerService } from '../../infra/abac/casbin-enforcer.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreateProjectDto, QueryProjectsDto, UpdateProjectDto } from './dto/projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casbin: CasbinEnforcerService,
    private readonly audit: AuditService,
  ) {}

  // --- Quy ước Casbin ---
  roleName(projectId: string, projectRole: string): string {
    return `role_${projectRole.toLowerCase()}_${projectId}`;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const roles = await this.casbin.getRolesForUser(userId);
    return roles.includes('role_admin');
  }

  /** PM owner / Admin / thành viên có project_role = PM mới được quản trị dự án. */
  async assertManager(projectId: string, user: AuthenticatedUser): Promise<void> {
    if (await this.isAdmin(user.sub)) return;
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    if (!project) throw new NotFoundException('Không tìm thấy dự án.');
    if (project.ownerId === user.sub) return;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.sub } },
      select: { projectRole: true },
    });
    if (membership?.projectRole !== 'PM') {
      throw new ForbiddenException('Bạn không có quyền quản trị dự án này.');
    }
  }

  private canCreateProject(user: AuthenticatedUser): boolean {
    return user.title === 'Project Manager';
  }

  // --- Luồng 10: Portfolio (Data Isolation) ---
  async listProjects(user: AuthenticatedUser, q: QueryProjectsDto) {
    const admin = await this.isAdmin(user.sub);
    const where: Prisma.ProjectWhereInput = {
      AND: [
        admin
          ? {}
          : { OR: [{ ownerId: user.sub }, { members: { some: { userId: user.sub } } }] },
        q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {},
        q.status ? { status: q.status } : {},
      ],
    };

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { documents: true, members: true } },
          owner: { select: { fullName: true } },
          members: { where: { userId: user.sub }, select: { projectRole: true } },
          preferences: { where: { userId: user.sub }, select: { isStarred: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: items.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        role: p.members[0]?.projectRole ?? (p.ownerId === user.sub ? 'PM' : admin ? 'ADMIN' : null),
        isStarred: p.preferences[0]?.isStarred ?? false,
        owner: p.owner?.fullName ?? null,
        documentCount: p._count.documents,
        memberCount: p._count.members,
        createdAt: p.createdAt,
      })),
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / q.limit),
        currentPage: q.page,
      },
    };
  }

  // --- Luồng 11: Khởi tạo dự án (ACID + sinh folder từ template) ---
  async createProject(user: AuthenticatedUser, dto: CreateProjectDto) {
    const admin = await this.isAdmin(user.sub);
    if (!admin && !this.canCreateProject(user)) {
      throw new ForbiddenException('Chỉ Project Manager hoặc Admin mới được tạo dự án.');
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: { name: dto.name, description: dto.description, ownerId: user.sub, status: 'ACTIVE' },
      });

      // PM (người tạo) là thành viên cứng
      await tx.projectMember.create({
        data: { projectId: proj.id, userId: user.sub, projectRole: 'PM' },
      });

      if (dto.templateType) {
        await this.generateFoldersFromTemplate(tx, proj.id, dto.templateType);
      }

      if (dto.initialMembers?.length) {
        for (const m of dto.initialMembers) {
          if (m.userId === user.sub) continue; // tránh trùng PM
          await tx.projectMember.create({
            data: { projectId: proj.id, userId: m.userId, projectRole: m.projectRole },
          });
        }
      }
      return proj;
    });

    // Đồng bộ Casbin sau khi commit DB
    await this.casbin.addGroupingPolicy(user.sub, this.roleName(project.id, 'PM'));
    await this.casbin.addPolicy(this.roleName(project.id, 'PM'), `/api/v1/projects/${project.id}/*`, '*');
    if (dto.initialMembers?.length) {
      for (const m of dto.initialMembers) {
        if (m.userId === user.sub) continue;
        await this.casbin.addGroupingPolicy(m.userId, this.roleName(project.id, m.projectRole));
      }
    }

    await this.audit.log({
      action: 'PROJECT_INITIALIZED',
      userId: user.sub,
      targetId: project.id,
      isSuccess: true,
      metadata: { name: project.name, templateType: dto.templateType ?? null },
    });

    return { projectId: project.id, message: 'Khởi tạo dự án và cây thư mục chuẩn hóa thành công.' };
  }

  private async generateFoldersFromTemplate(
    tx: Prisma.TransactionClient,
    projectId: string,
    templateType: string,
  ): Promise<void> {
    const template = await tx.projectTemplate.findUnique({
      where: { templateType },
      include: { folders: true },
    });
    if (!template) throw new BadRequestException('Mẫu dự án không tồn tại.');

    // Sắp theo độ sâu (cha trước con), rồi displayOrder
    const depth = (p: string | null) => (p ? p.split('/').length : 0);
    const folders = [...template.folders].sort(
      (a, b) => depth(a.parentPath) - depth(b.parentPath) || a.displayOrder - b.displayOrder,
    );

    const pathToId = new Map<string, string>();
    for (const tf of folders) {
      const parentId = tf.parentPath ? pathToId.get(tf.parentPath) ?? null : null;
      const created = await tx.folder.create({
        data: { projectId, parentId, name: tf.name, isLocked: tf.isLocked },
      });
      const ownPath = tf.parentPath ? `${tf.parentPath}/${tf.name}` : tf.name;
      pathToId.set(ownPath, created.id);
    }
  }

  // --- Luồng 14: Chi tiết / cấu hình ---
  async getProject(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, fullName: true } },
        members: { where: { userId: user.sub }, select: { projectRole: true } },
        _count: { select: { documents: true, members: true } },
      },
    });
    if (!project) throw new NotFoundException('Không tìm thấy dự án.');

    const admin = await this.isAdmin(user.sub);
    const isMember = project.members.length > 0 || project.ownerId === user.sub;
    if (!admin && !isMember) {
      throw new ForbiddenException('Bạn không có quyền truy cập dự án này.');
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      owner: project.owner,
      role: project.members[0]?.projectRole ?? (project.ownerId === user.sub ? 'PM' : admin ? 'ADMIN' : null),
      documentCount: project._count.documents,
      memberCount: project._count.members,
      createdAt: project.createdAt,
    };
  }

  async updateProject(projectId: string, user: AuthenticatedUser, dto: UpdateProjectDto, ip: string) {
    await this.assertManager(projectId, user);

    if (dto.status === 'ARCHIVED') {
      return this.archiveProject(projectId, user, ip);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { name: dto.name, description: dto.description },
    });
    await this.audit.log({ action: 'PROJECT_UPDATED', userId: user.sub, targetId: projectId, ipAddress: ip, isSuccess: true });
    return { message: 'Đã cập nhật cấu hình dự án.' };
  }

  private async archiveProject(projectId: string, user: AuthenticatedUser, ip: string) {
    await this.prisma.$transaction([
      this.prisma.project.update({ where: { id: projectId }, data: { status: 'ARCHIVED' } }),
      // Gỡ khóa biên tập tạm trên tài liệu của dự án (đưa về read-only tĩnh)
      this.prisma.document.updateMany({ where: { projectId, lockedBy: { not: null } }, data: { lockedBy: null } }),
    ]);
    await this.audit.log({ action: 'PROJECT_ARCHIVED', userId: user.sub, targetId: projectId, ipAddress: ip, isSuccess: true });
    return { message: 'Trạng thái dự án đã được chuyển sang ARCHIVED. Toàn bộ tài liệu đã khóa.' };
  }

  async restoreProject(projectId: string, user: AuthenticatedUser, ip: string) {
    await this.assertManager(projectId, user);
    await this.prisma.project.update({ where: { id: projectId }, data: { status: 'ACTIVE' } });
    await this.audit.log({ action: 'PROJECT_RESTORED', userId: user.sub, targetId: projectId, ipAddress: ip, isSuccess: true });
    return { message: 'Đã khôi phục dự án. Đội ngũ có thể tiếp tục thao tác.' };
  }

  // --- Luồng 10: Ghim dự án ---
  async toggleStar(projectId: string, userId: string, isStarred: boolean) {
    await this.prisma.userProjectPreference.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: { isStarred },
      create: { userId, projectId, isStarred },
    });
    return { message: isStarred ? 'Đã ghim dự án.' : 'Đã bỏ ghim dự án.' };
  }
}
