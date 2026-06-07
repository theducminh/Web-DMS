import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infra/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import {
  CreateTemplateDto,
  CreateTemplateFolderDto,
  UpdateTemplateDto,
  UpdateTemplateFolderDto,
  UpdateTemplateStatusDto,
} from './dto/templates.dto';

export interface FolderNode {
  id: string;
  name: string;
  parentPath: string | null;
  isLocked: boolean;
  displayOrder: number;
  description: string | null;
  children: FolderNode[];
}

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Liệt kê (bao gồm cả inactive cho Admin) ---
  async list() {
    const tmpls = await this.prisma.projectTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { folders: { orderBy: { displayOrder: 'asc' } } },
    });
    return tmpls.map((t) => ({
      id: t.id,
      name: t.name,
      templateType: t.templateType,
      description: t.description,
      isActive: t.isActive,
      createdAt: t.createdAt,
      folders: this.buildTree(t.folders),
    }));
  }

  // --- Tạo template (P2002 -> 409 do GlobalExceptionFilter) ---
  async create(dto: CreateTemplateDto, admin: AuthenticatedUser, ip: string) {
    const t = await this.prisma.projectTemplate.create({
      data: { name: dto.name, templateType: dto.templateType, description: dto.description },
    });
    await this.audit.log({ action: 'TEMPLATE_CREATE', userId: admin.sub, targetId: t.id, ipAddress: ip, isSuccess: true });
    return { id: t.id, message: 'Tạo template thành công.' };
  }

  async update(id: string, dto: UpdateTemplateDto, admin: AuthenticatedUser, ip: string) {
    await this.ensureTemplate(id);
    await this.prisma.projectTemplate.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
    await this.audit.log({ action: 'TEMPLATE_UPDATE', userId: admin.sub, targetId: id, ipAddress: ip, isSuccess: true });
    return { message: 'Đã cập nhật template.' };
  }

  // --- Soft disable (No Cascade Delete on Active Projects) ---
  async setStatus(id: string, dto: UpdateTemplateStatusDto, admin: AuthenticatedUser, ip: string) {
    await this.ensureTemplate(id);
    await this.prisma.projectTemplate.update({ where: { id }, data: { isActive: dto.isActive } });
    await this.audit.log({ action: 'TEMPLATE_UPDATE', userId: admin.sub, targetId: id, ipAddress: ip, isSuccess: true, metadata: { isActive: dto.isActive } });
    return {
      message: dto.isActive
        ? 'Đã kích hoạt lại template.'
        : 'Đã lưu trữ template. Template sẽ ẩn khỏi màn hình Tạo dự án.',
    };
  }

  // --- Thêm folder vào template ---
  async addFolder(templateId: string, dto: CreateTemplateFolderDto, admin: AuthenticatedUser, ip: string) {
    await this.ensureTemplate(templateId);

    let parentPath: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.templateFolder.findFirst({
        where: { id: dto.parentId, templateId },
      });
      if (!parent) throw new NotFoundException('Folder cha không thuộc template này.');
      parentPath = parent.parentPath ? `${parent.parentPath}/${parent.name}` : parent.name;
    }

    // Chống trùng tên cùng cấp
    const dup = await this.prisma.templateFolder.findFirst({
      where: { templateId, parentPath, name: dto.name },
      select: { id: true },
    });
    if (dup) throw new BadRequestException('Trùng tên thư mục cùng cấp.');

    const folder = await this.prisma.templateFolder.create({
      data: {
        templateId,
        name: dto.name,
        parentPath,
        isLocked: dto.isLocked ?? false,
        displayOrder: dto.displayOrder ?? 0,
        description: dto.description,
      },
    });
    await this.audit.log({ action: 'TEMPLATE_FOLDER_ADD', userId: admin.sub, targetId: folder.id, ipAddress: ip, isSuccess: true, metadata: { templateId, parentPath, name: dto.name } });
    return { folderId: folder.id, message: 'Thêm thư mục vào mẫu thành công.' };
  }

  // --- Cập nhật folder (Cascade Path Materialization khi đổi tên) ---
  async updateFolder(
    templateId: string,
    folderId: string,
    dto: UpdateTemplateFolderDto,
    admin: AuthenticatedUser,
    ip: string,
  ) {
    const folder = await this.prisma.templateFolder.findFirst({ where: { id: folderId, templateId } });
    if (!folder) throw new NotFoundException('Không tìm thấy thư mục.');
    if (folder.isLocked && (dto.name !== undefined && dto.name !== folder.name)) {
      throw new ForbiddenException('Thư mục đã khóa không thể đổi tên.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Cập nhật chính folder
      await tx.templateFolder.update({
        where: { id: folderId },
        data: {
          name: dto.name ?? folder.name,
          isLocked: dto.isLocked ?? folder.isLocked,
          description: dto.description ?? folder.description,
          displayOrder: dto.displayOrder ?? folder.displayOrder,
        },
      });

      // Nếu đổi tên -> cập nhật parent_path của mọi hậu duệ (Path Materialization)
      if (dto.name && dto.name !== folder.name) {
        const oldPath = folder.parentPath ? `${folder.parentPath}/${folder.name}` : folder.name;
        const newPath = folder.parentPath ? `${folder.parentPath}/${dto.name}` : dto.name;

        // Hậu duệ trực tiếp (parent_path == oldPath) -> đổi sang newPath
        await tx.templateFolder.updateMany({
          where: { templateId, parentPath: oldPath },
          data: { parentPath: newPath },
        });
        // Hậu duệ sâu hơn (parent_path bắt đầu bằng oldPath + '/') -> thay tiền tố
        await tx.$executeRawUnsafe(
          `UPDATE template_folders
             SET parent_path = ${this.sqlLiteral(newPath)} || substring(parent_path FROM ${oldPath.length + 1})
           WHERE template_id = ${this.sqlLiteral(templateId)}::uuid
             AND parent_path LIKE ${this.sqlLiteral(oldPath + '/%')};`,
        );
      }
    });

    await this.audit.log({ action: 'TEMPLATE_FOLDER_UPDATE', userId: admin.sub, targetId: folderId, ipAddress: ip, isSuccess: true });
    return { message: 'Đã cập nhật thư mục.' };
  }

  // --- Xóa folder (kèm hậu duệ; cấm xóa thư mục đã khóa) ---
  async removeFolder(templateId: string, folderId: string, admin: AuthenticatedUser, ip: string) {
    const folder = await this.prisma.templateFolder.findFirst({ where: { id: folderId, templateId } });
    if (!folder) throw new NotFoundException('Không tìm thấy thư mục.');
    if (folder.isLocked) {
      throw new ForbiddenException('Không thể xóa thư mục chuẩn của tập đoàn (is_locked).');
    }

    const fullPath = folder.parentPath ? `${folder.parentPath}/${folder.name}` : folder.name;
    await this.prisma.$transaction([
      // Xóa toàn bộ hậu duệ
      this.prisma.templateFolder.deleteMany({
        where: {
          templateId,
          OR: [{ parentPath: fullPath }, { parentPath: { startsWith: fullPath + '/' } }],
        },
      }),
      // Xóa chính nó
      this.prisma.templateFolder.delete({ where: { id: folderId } }),
    ]);
    await this.audit.log({ action: 'TEMPLATE_FOLDER_DELETE', userId: admin.sub, targetId: folderId, ipAddress: ip, isSuccess: true, metadata: { path: fullPath } });
    return { message: 'Đã xóa thư mục (kèm các thư mục con).' };
  }

  // ---------- helpers ----------
  private async ensureTemplate(id: string): Promise<void> {
    const t = await this.prisma.projectTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException('Không tìm thấy template.');
  }

  private buildTree(folders: any[]): FolderNode[] {
    const nodes = new Map<string, FolderNode>();
    const roots: FolderNode[] = [];
    const sorted = [...folders].sort(
      (a, b) =>
        (a.parentPath ? a.parentPath.split('/').length : 0) -
          (b.parentPath ? b.parentPath.split('/').length : 0) || a.displayOrder - b.displayOrder,
    );
    for (const f of sorted) {
      const node: FolderNode = {
        id: f.id,
        name: f.name,
        parentPath: f.parentPath,
        isLocked: f.isLocked,
        displayOrder: f.displayOrder,
        description: f.description,
        children: [],
      };
      const own = f.parentPath ? `${f.parentPath}/${f.name}` : f.name;
      nodes.set(own, node);
      if (f.parentPath && nodes.has(f.parentPath)) nodes.get(f.parentPath)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  // Đơn giản hóa: dùng cho $executeRawUnsafe nội bộ, KHÔNG chấp nhận input không kiểm soát.
  private sqlLiteral(s: string): string {
    return `'${s.replace(/'/g, "''")}'`;
  }
}
