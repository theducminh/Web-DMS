import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DocumentAccessService } from './document-access.service';
import { CreateFolderDto, MoveDocumentDto, UpdateFolderDto } from './dto/documents.dto';
import { MailService } from '../auth/mail.service';

@Injectable()
export class FoldersService {
  private readonly lockTtl = Number(process.env.DOC_LOCK_TTL_SECONDS ?? 7200);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly access: DocumentAccessService,
    private readonly mail: MailService,
  ) {}

  private lockKey(docId: string): string {
    return `doc:lock:${docId}`;
  }

  // --- Luồng 12: Nội dung thư mục (breadcrumbs + subfolders + documents) ---
  async getContents(projectId: string, folderId: string, user: AuthenticatedUser) {
    await this.access.assertMember(projectId, user);

    const isRoot = folderId === 'root';
    let currentFolder: { id: string; name: string } | null = null;
    const breadcrumbs: { id: string; name: string }[] = [];

    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
    breadcrumbs.push({ id: 'root', name: project?.name ?? 'Dự án' });

    if (!isRoot) {
      const folder = await this.prisma.folder.findFirst({ where: { id: folderId, projectId } });
      if (!folder) throw new NotFoundException('Không tìm thấy thư mục.');
      currentFolder = { id: folder.id, name: folder.name };
      // Breadcrumbs: đi ngược lên cây cha
      const chain: { id: string; name: string }[] = [];
      let cursor: string | null = folder.id;
      while (cursor) {
        const f = await this.prisma.folder.findUnique({ where: { id: cursor }, select: { id: true, name: true, parentId: true } });
        if (!f) break;
        chain.unshift({ id: f.id, name: f.name });
        cursor = f.parentId;
      }
      breadcrumbs.push(...chain);
    }

    const subFolders = await this.prisma.folder.findMany({
      where: { projectId, parentId: isRoot ? null : folderId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isLocked: true, createdAt: true },
    });

    const documents = await this.prisma.document.findMany({
      where: { projectId, folderId: isRoot ? null : folderId, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1, select: { versionNo: true } },
      },
    });

    // Trạng thái khóa (Redis)
    const lockVals = documents.length
      ? await this.redis.client.mget(documents.map((d) => this.lockKey(d.id)))
      : [];

    return {
      currentFolder,
      breadcrumbs,
      subFolders,
      documents: documents.map((d, i) => ({
        id: d.id,
        title: d.title,
        securityLevel: d.securityLevel,
        status: d.status,
        currentVersion: d.versions[0]?.versionNo ?? 0,
        lockedBy: lockVals[i] ?? null,
        updatedAt: d.updatedAt,
      })),
    };
  }

  // --- Tạo thư mục con (Template Constraint Check) ---
  async createFolder(projectId: string, dto: CreateFolderDto, user: AuthenticatedUser) {
    await this.access.assertCanEdit(projectId, user);
    await this.access.assertProjectActive(projectId);

    if (dto.parentId) {
      const parent = await this.prisma.folder.findFirst({ where: { id: dto.parentId, projectId } });
      if (!parent) throw new NotFoundException('Thư mục cha không tồn tại.');
      if (parent.isLocked) {
        throw new ForbiddenException('Không thể thêm thư mục con vào thư mục chuẩn của tập đoàn.');
      }
    }

    const folder = await this.prisma.folder.create({
      data: { projectId, parentId: dto.parentId ?? null, name: dto.name, isLocked: false },
    });
    await this.audit.log({ action: 'FOLDER_CREATE', userId: user.sub, targetId: folder.id, isSuccess: true });
    return { id: folder.id, message: 'Tạo thư mục thành công.' };
  }

  // --- Đổi tên / di chuyển thư mục (Template Lock + Cycle Detection) ---
  async updateFolder(projectId: string, folderId: string, dto: UpdateFolderDto, user: AuthenticatedUser) {
    await this.access.assertCanEdit(projectId, user);
    await this.access.assertProjectActive(projectId);

    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, projectId } });
    if (!folder) throw new NotFoundException('Không tìm thấy thư mục.');
    if (folder.isLocked) {
      throw new ForbiddenException('Thư mục chuẩn của tập đoàn không thể đổi tên/di chuyển.');
    }

    if (dto.parentId !== undefined && dto.parentId !== folder.parentId) {
      if (dto.parentId === folderId) throw new BadRequestException('Không thể di chuyển thư mục vào chính nó.');
      if (dto.parentId && (await this.isDescendant(folderId, dto.parentId))) {
        throw new BadRequestException('Không thể di chuyển thư mục vào thư mục con của nó (vòng lặp).');
      }
    }

    await this.prisma.folder.update({
      where: { id: folderId },
      data: { name: dto.name ?? folder.name, parentId: dto.parentId ?? folder.parentId },
    });
    await this.audit.log({ action: 'FOLDER_UPDATE', userId: user.sub, targetId: folderId, isSuccess: true });
    return { message: 'Đã cập nhật thư mục.' };
  }

  // Kiểm tra targetId có nằm trong cây con của folderId không (chống vòng lặp)
  private async isDescendant(folderId: string, targetId: string): Promise<boolean> {
    let cursor: string | null = targetId;
    while (cursor) {
      const f = await this.prisma.folder.findUnique({ where: { id: cursor }, select: { parentId: true } });
      if (!f) return false;
      if (f.parentId === folderId) return true;
      cursor = f.parentId;
    }
    return false;
  }

  // --- Di chuyển tài liệu sang thư mục khác ---
  async moveDocument(docId: string, dto: MoveDocumentDto, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId }, select: { projectId: true } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.access.assertCanEdit(doc.projectId, user);
    await this.access.assertProjectActive(doc.projectId);

    const target = await this.prisma.folder.findFirst({ where: { id: dto.newFolderId, projectId: doc.projectId } });
    if (!target) throw new BadRequestException('Thư mục đích không hợp lệ.');

    await this.prisma.document.update({ where: { id: docId }, data: { folderId: dto.newFolderId } });
    await this.audit.log({ action: 'DOCUMENT_MOVE', userId: user.sub, targetId: docId, isSuccess: true });
    return { message: 'Đã di chuyển tài liệu thành công.' };
  }

  // --- Xóa mềm (chỉ PM/Admin/Uploader); gỡ khóa ---
  async softDelete(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId }, select: { projectId: true, createdBy: true } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');

    const role = await this.access.getProjectRole(doc.projectId, user);
    const isOwnerUploader = doc.createdBy === user.sub;
    if (!['ADMIN', 'PM'].includes(role ?? '') && !isOwnerUploader) {
      throw new ForbiddenException('Chỉ PM hoặc người tải lên mới được xóa tài liệu.');
    }
    await this.access.assertProjectActive(doc.projectId);

    await this.prisma.document.update({ where: { id: docId }, data: { isDeleted: true, lockedBy: null } });
    await this.redis.client.del(this.lockKey(docId));
    await this.audit.log({ action: 'DOCUMENT_SOFT_DELETE', userId: user.sub, targetId: docId, isSuccess: true });
    return { message: 'Tài liệu đã được chuyển vào thùng rác.' };
  }

  // --- Thùng rác (chỉ PM/Admin) ---
  async listTrash(projectId: string, user: AuthenticatedUser) {
    const role = await this.access.getProjectRole(projectId, user);
    if (!['ADMIN', 'PM'].includes(role ?? '')) {
      throw new ForbiddenException('Chỉ PM hoặc Admin mới xem được thùng rác.');
    }
    const docs = await this.prisma.document.findMany({
      where: { projectId, isDeleted: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    });
    return docs;
  }

  async restoreFromTrash(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId }, select: { projectId: true } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    const role = await this.access.getProjectRole(doc.projectId, user);
    if (!['ADMIN', 'PM'].includes(role ?? '')) {
      throw new ForbiddenException('Chỉ PM hoặc Admin mới khôi phục được tài liệu.');
    }
    await this.prisma.document.update({ where: { id: docId }, data: { isDeleted: false } });
    await this.audit.log({ action: 'DOCUMENT_RESTORE_TRASH', userId: user.sub, targetId: docId, isSuccess: true });
    return { message: 'Đã khôi phục tài liệu khỏi thùng rác.' };
  }

  // --- Pessimistic Lock (Redis SETEX) ---
  async lock(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId }, select: { projectId: true } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.access.assertCanEdit(doc.projectId, user);
    await this.access.assertProjectActive(doc.projectId);

    const current = await this.redis.client.get(this.lockKey(docId));
    if (current && current !== user.sub) {
      throw new ConflictException('Tài liệu đang bị khóa bởi người khác.');
    }
    await this.redis.client.set(this.lockKey(docId), user.sub, 'EX', this.lockTtl);
    return {
      lockedBy: user.sub,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.lockTtl * 1000).toISOString(),
    };
  }

  async unlock(docId: string, user: AuthenticatedUser) {
    const current = await this.redis.client.get(this.lockKey(docId));
    if (current && current !== user.sub) {
      throw new ForbiddenException('Bạn không giữ khóa tài liệu này.');
    }
    await this.redis.client.del(this.lockKey(docId));
    return { message: 'Đã mở khóa tài liệu thành công.' };
  }

  async heartbeat(docId: string, user: AuthenticatedUser) {
    const current = await this.redis.client.get(this.lockKey(docId));
    if (current !== user.sub) {
      throw new ForbiddenException('Bạn không giữ khóa tài liệu này.');
    }
    await this.redis.client.expire(this.lockKey(docId), this.lockTtl);
    return {
      message: 'Gia hạn khóa thành công.',
      newExpiresAt: new Date(Date.now() + this.lockTtl * 1000).toISOString(),
    };
  }

  // D4 (Phase 5): "Xin trả khóa" — user khác đang giữ lock, requester nhờ release.
  // Gửi email cho owner + audit log + Redis set TTL 1h chống spam.
  async requestUnlock(docId: string, reason: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, projectId: true, title: true },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.access.assertMember(doc.projectId, user);

    const lockOwnerId = await this.redis.client.get(this.lockKey(docId));
    if (!lockOwnerId) throw new BadRequestException('Tài liệu hiện không bị khóa.');
    if (lockOwnerId === user.sub) throw new BadRequestException('Bạn đang giữ khóa — chỉ cần "Trả khóa".');

    // Anti-spam: 1 user chỉ xin được 1 lần / 1 tài liệu / 1 giờ
    const spamKey = `lock:request:${docId}:${user.sub}`;
    const recent = await this.redis.client.get(spamKey);
    if (recent) {
      throw new BadRequestException('Bạn đã xin trả khóa tài liệu này trong vòng 1 giờ. Vui lòng đợi.');
    }
    await this.redis.client.set(spamKey, '1', 'EX', 3600);

    // Lookup info owner + requester để gửi mail
    const [owner, requester] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { id: lockOwnerId },
        select: { email: true, fullName: true },
      }),
      this.prisma.profile.findUnique({
        where: { id: user.sub },
        select: { email: true, fullName: true },
      }),
    ]);

    if (owner?.email) {
      // Tận dụng MailService.sendReviewResult format (đơn giản — text/subject custom)
      await this.mail.sendReviewResult(owner.email, {
        documentTitle: doc.title,
        decision: 'REQUEST_UNLOCK',
        reason: `${requester?.fullName ?? 'Một thành viên'} (${requester?.email}) xin bạn trả khóa tài liệu này.\nLý do: ${reason}\n\nVui lòng vào https://localhost/documents/${docId}/detail để xem xét và bấm "Trả khóa" nếu đồng ý.`,
        reviewerName: requester?.fullName ?? user.sub,
      });
    }

    await this.audit.log({
      action: 'DOCUMENT_UNLOCK_REQUEST',
      userId: user.sub,
      targetId: docId,
      isSuccess: true,
      metadata: { lockOwnerId, reason },
    });

    return {
      message: `Đã gửi yêu cầu trả khóa tới ${owner?.fullName ?? 'người đang giữ'}. Vui lòng đợi họ phản hồi.`,
    };
  }

  async forceUnlock(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId }, select: { projectId: true } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    const role = await this.access.getProjectRole(doc.projectId, user);
    if (!['ADMIN', 'PM'].includes(role ?? '')) {
      throw new ForbiddenException('Chỉ PM mới được mở khóa ép buộc.');
    }
    await this.redis.client.del(this.lockKey(docId));
    await this.audit.log({ action: 'DOCUMENT_FORCE_UNLOCK', userId: user.sub, targetId: docId, isSuccess: true });
    return { message: 'Đã mở khóa ép buộc. Hành động này đã được ghi vào Audit Log.' };
  }
}
