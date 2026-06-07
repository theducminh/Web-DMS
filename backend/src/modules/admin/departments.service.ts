import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  UpdateDepartmentStatusDto,
} from './dto/admin.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Luồng 9: Danh sách + đếm nhân sự (Relational Aggregation) ---
  async list() {
    const depts = await this.prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { profiles: true } } },
    });
    return depts.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      isActive: d.isActive,
      employeeCount: d._count.profiles,
      createdAt: d.createdAt,
    }));
  }

  // Tạo mới — trùng tên: Prisma P2002 -> GlobalExceptionFilter trả 409.
  async create(dto: CreateDepartmentDto, adminId: string, ip: string) {
    const dept = await this.prisma.department.create({
      data: { name: dto.name, description: dto.description },
    });
    await this.audit.log({ action: 'DEPARTMENT_CREATE', userId: adminId, targetId: dept.id, ipAddress: ip, isSuccess: true });
    return { id: dept.id, message: 'Tạo phòng ban thành công' };
  }

  async update(id: string, dto: UpdateDepartmentDto, adminId: string, ip: string) {
    await this.ensureExists(id);
    await this.prisma.department.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
    await this.audit.log({ action: 'DEPARTMENT_UPDATE', userId: adminId, targetId: id, ipAddress: ip, isSuccess: true });
    return { message: 'Đã cập nhật phòng ban.' };
  }

  // Xóa cứng — chặn nếu còn nhân sự (tránh vi phạm FK / mồ côi).
  async remove(id: string, adminId: string, ip: string) {
    const count = await this.prisma.profile.count({ where: { departmentId: id } });
    if (count > 0) {
      throw new BadRequestException('Phòng ban có nhân sự, không thể xóa.');
    }
    await this.prisma.department.delete({ where: { id } });
    await this.audit.log({ action: 'DEPARTMENT_DELETE', userId: adminId, targetId: id, ipAddress: ip, isSuccess: true });
    return { message: 'Đã xóa phòng ban.' };
  }

  // Soft disable (thay thế cho xóa) — vẫn check còn nhân sự khi disable.
  async setStatus(id: string, dto: UpdateDepartmentStatusDto, adminId: string, ip: string) {
    await this.ensureExists(id);
    if (dto.isActive === false) {
      const count = await this.prisma.profile.count({ where: { departmentId: id } });
      if (count > 0) {
        throw new BadRequestException('Phòng ban có nhân sự, không thể lưu trữ.');
      }
    }
    await this.prisma.department.update({ where: { id }, data: { isActive: dto.isActive } });
    await this.audit.log({ action: 'DEPARTMENT_UPDATE', userId: adminId, targetId: id, ipAddress: ip, isSuccess: true, metadata: { isActive: dto.isActive } });
    return {
      message: dto.isActive
        ? 'Đã kích hoạt lại phòng ban.'
        : 'Đã lưu trữ phòng ban. Phòng ban này sẽ bị ẩn trong các danh sách chọn.',
    };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Không tìm thấy phòng ban.');
  }
}
