import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthService } from '../auth/auth.service';
import {
  BulkAttributesDto,
  BulkStatusDto,
  QueryUsersDto,
  UpdateAttributesDto,
} from './dto/admin.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // --- Luồng 7: Danh bạ user (phân trang + lọc) ---
  async findUsers(q: QueryUsersDto) {
    const where: Prisma.ProfileWhereInput = {
      AND: [
        q.search
          ? {
              OR: [
                { fullName: { contains: q.search, mode: 'insensitive' } },
                { email: { contains: q.search, mode: 'insensitive' } },
                { phone: { contains: q.search } },
              ],
            }
          : {},
        q.departmentId ? { departmentId: q.departmentId } : {},
        q.status ? { status: q.status } : {},
      ],
    };

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.profile.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: { department: { select: { name: true } } },
      }),
      this.prisma.profile.count({ where }),
    ]);

    return {
      data: items.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        department: u.department?.name ?? null,
        title: u.title,
        clearanceLevel: u.clearanceLevel,
      })),
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / q.limit),
        currentPage: q.page,
      },
    };
  }

  // --- Luồng 7: Đổi trạng thái hàng loạt (DISABLED -> Mass Session Eviction) ---
  async bulkStatus(dto: BulkStatusDto, adminId: string, ip: string) {
    await this.prisma.profile.updateMany({
      where: { id: { in: dto.userIds } },
      data: { status: dto.status },
    });

    if (dto.status === 'DISABLED') {
      for (const userId of dto.userIds) {
        await this.auth.revokeAllSessions(userId);
      }
    }

    await this.audit.log({
      action: 'BULK_STATUS_UPDATE',
      userId: adminId,
      ipAddress: ip,
      isSuccess: true,
      metadata: { userIds: dto.userIds, status: dto.status, reason: dto.reason ?? null },
    });

    const verb = dto.status === 'DISABLED' ? 'vô hiệu hóa' : dto.status === 'ACTIVE' ? 'kích hoạt' : 'cập nhật';
    return { message: `Đã ${verb} thành công ${dto.userIds.length} tài khoản.` };
  }

  // --- Luồng 7: Gán phòng ban/chức vụ hàng loạt (claims đổi -> force re-login) ---
  async bulkAttributes(dto: BulkAttributesDto, adminId: string, ip: string) {
    const data: Prisma.ProfileUncheckedUpdateManyInput = {};
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.title !== undefined) data.title = dto.title;

    await this.prisma.profile.updateMany({ where: { id: { in: dto.userIds } }, data });
    for (const userId of dto.userIds) await this.auth.revokeAllSessions(userId);

    await this.audit.log({
      action: 'BULK_ATTRIBUTES_UPDATE',
      userId: adminId,
      ipAddress: ip,
      isSuccess: true,
      metadata: { userIds: dto.userIds, departmentId: dto.departmentId ?? null, title: dto.title ?? null },
    });
    return { message: `Đã cập nhật thuộc tính cho ${dto.userIds.length} nhân sự.` };
  }

  // --- Luồng 8: Lấy thuộc tính ABAC của 1 user ---
  async getUserAttributes(userId: string) {
    const u = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { department: { select: { name: true } } },
    });
    if (!u) throw new NotFoundException('Không tìm thấy nhân sự.');
    return {
      userId: u.id,
      fullName: u.fullName,
      email: u.email,
      status: u.status,
      currentAttributes: {
        departmentId: u.departmentId,
        department: u.department?.name ?? null,
        title: u.title,
        clearanceLevel: u.clearanceLevel,
      },
    };
  }

  // --- Luồng 8: Cập nhật thuộc tính ABAC (FR-1.2.1 force-logout + FR-5.1.2 before/after) ---
  async updateUserAttributes(userId: string, dto: UpdateAttributesDto, adminId: string, ip: string) {
    const before = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!before) throw new NotFoundException('Không tìm thấy nhân sự.');

    const data: Prisma.ProfileUpdateInput = { clearanceLevel: dto.clearanceLevel };
    if (dto.departmentId !== undefined) {
      data.department = { connect: { id: dto.departmentId } };
    }
    if (dto.title !== undefined) data.title = dto.title;

    const after = await this.prisma.profile.update({ where: { id: userId }, data });

    // Force Eviction: hủy mọi phiên + cache quyền -> user phải đăng nhập lại nhận JWT mới
    await this.auth.revokeAllSessions(userId);

    await this.audit.log({
      action: 'ATTRIBUTES_UPDATED',
      userId: adminId,
      targetId: userId,
      ipAddress: ip,
      isSuccess: true,
      metadata: {
        before: { departmentId: before.departmentId, title: before.title, clearanceLevel: before.clearanceLevel },
        after: { departmentId: after.departmentId, title: after.title, clearanceLevel: after.clearanceLevel },
      },
    });

    return { message: 'Cập nhật thuộc tính ABAC thành công. Đã vô hiệu hóa các phiên làm việc cũ.' };
  }
}
