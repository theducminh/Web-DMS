import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';
import { MinioS3Service } from '../../infra/storage/minio-s3.service';
import { TEXT_EXTRACTION_QUEUE } from '../../infra/queue/queue.module';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DocumentAccessService } from './document-access.service';
import { UploadDocumentDto } from './dto/documents.dto';
import { DocumentValidator, EXTRACTABLE_DOCUMENT_TYPES } from './document-validator.service';
import { DocumentVersionFactory } from './document-version.factory';

@Injectable()
export class DocumentsService {
  private readonly extractMax = Number(process.env.TEXT_EXTRACT_MAX_BYTES ?? 15 * 1024 * 1024);
  private readonly anomalyThreshold = Number(process.env.ANOMALY_DOWNLOAD_THRESHOLD ?? 10);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: MinioS3Service,
    private readonly audit: AuditService,
    private readonly access: DocumentAccessService,
    // F4 (Phase 6) SOLID refactor: 2 collaborator chuyên trách
    private readonly validator: DocumentValidator,
    private readonly versionFactory: DocumentVersionFactory,
    @InjectQueue(TEXT_EXTRACTION_QUEUE) private readonly extractionQueue: Queue,
  ) {}

  /**
   * F4 (Phase 6) — Luồng 15: Upload tài liệu (mới hoặc version kế tiếp).
   *
   * SOLID refactor: method này giờ chỉ ORCHESTRATE 5 bước rõ ràng, KHÔNG còn
   * trộn lẫn validation + storage + version logic. Mỗi bước delegate cho 1
   * collaborator phù hợp:
   *   (1) ABAC check          -> DocumentAccessService
   *   (2) Validate input      -> DocumentValidator     (SRP)
   *   (3) Resolve documentId  -> private helper (orchestration)
   *   (4) Tạo version + store -> DocumentVersionFactory (SRP)
   *   (5) Side-effects        -> audit + queue extraction
   *
   * Open-Closed: thêm rule validate mới = thêm method vào DocumentValidator,
   * KHÔNG sửa method này. Đổi storage provider = swap DocumentVersionFactory,
   * KHÔNG sửa method này.
   */
  async upload(projectId: string, file: Express.Multer.File, dto: UploadDocumentDto, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('Thiếu file tải lên.');

    // (1) ABAC
    await this.access.assertCanEdit(projectId, user);
    await this.access.assertProjectActive(projectId);

    // (2) Validate file type (whitelist .pdf/.docx/.md/.txt)
    const fileType = this.validator.validateFileType(file.originalname);

    // (3) Resolve document — tạo mới hoặc xác nhận document đang tồn tại
    const documentId = await this.resolveDocumentId(projectId, dto, user.sub);

    // (4) Tạo version + push storage + reset DRAFT (factory đảm nhiệm)
    const version = await this.versionFactory.storeAndCreateVersion({
      documentId,
      projectId,
      fileType,
      fileBuffer: file.buffer,
      fileSize: file.size,
      originalName: file.originalname,
      mimeType: file.mimetype,
      commitMessage: dto.commitMessage,
      uploadedBy: user.sub,
    });

    // (5) Side-effects
    if (EXTRACTABLE_DOCUMENT_TYPES.includes(fileType) && file.size < this.extractMax) {
      await this.extractionQueue.add('extract', {
        documentVersionId: version.id,
        storageKey: version.storageKey,
        fileType,
      });
    }
    await this.audit.log({
      action: 'DOCUMENT_UPLOAD',
      userId: user.sub,
      targetId: documentId,
      isSuccess: true,
      metadata: { versionNo: version.versionNo, fileType, fileSize: file.size },
    });

    return {
      documentId,
      versionId: version.id,
      message: 'Tải lên thành công. File đang được xử lý ngầm.',
    };
  }

  /**
   * Helper private — KHÔNG export. Chỉ orchestrate giữa Validator và Prisma:
   *   - Nếu dto.documentId có sẵn: validate Document tồn tại + đúng project + không UNDER_REVIEW
   *   - Nếu chưa có: validate không trùng tên + tạo Document row mới
   */
  private async resolveDocumentId(
    projectId: string,
    dto: UploadDocumentDto,
    userId: string,
  ): Promise<string> {
    if (dto.documentId) {
      await this.validator.assertDocumentEditable(dto.documentId, projectId);
      return dto.documentId;
    }
    const folderId = dto.folderId ?? null;
    await this.validator.assertNoDuplicateTitle(projectId, folderId, dto.title);
    const created = await this.prisma.document.create({
      data: {
        projectId,
        folderId,
        title: dto.title,
        securityLevel: (dto.securityLevel ?? 'INTERNAL') as any,
        status: 'DRAFT',
        createdBy: userId,
      },
    });
    return created.id;
  }

  // --- Luồng 16: Chi tiết tài liệu ---
  async getDetail(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: { uploader: { select: { fullName: true } } },
        },
      },
    });
    if (!doc || doc.isDeleted) throw new NotFoundException('Không tìm thấy tài liệu.');

    const role = await this.access.assertMember(doc.projectId, user);

    // Strict State Gatekeeper (FR-2.3.2): bản chưa Released chỉ PM/Admin/uploader thấy
    if (doc.status !== 'RELEASED' && !['ADMIN', 'PM'].includes(role) && doc.createdBy !== user.sub) {
      throw new ForbiddenException('Bạn không có quyền xem bản nháp tài liệu này.');
    }

    return {
      id: doc.id,
      projectId: doc.projectId, // B4: FE cần projectId để build link Upload version mới
      folderId: doc.folderId,
      title: doc.title,
      status: doc.status,
      securityLevel: doc.securityLevel,
      lockedBy: (await this.redis.client.get(`doc:lock:${doc.id}`)) ?? null,
      publishedVersionId: doc.publishedVersionId,
      versions: doc.versions.map((v) => ({
        id: v.id,
        versionNo: v.versionNo,
        commitMessage: v.commitMessage,
        uploadedBy: v.uploader.fullName,
        fileType: v.fileType,
        textExtracted: v.textExtracted,
        createdAt: v.createdAt,
      })),
    };
  }

  // --- Luồng 16: Rollback (Append-only — nhân bản version cũ thành version mới) ---
  async restoreVersion(docId: string, versionId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({ where: { id: docId }, select: { projectId: true } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.access.assertCanEdit(doc.projectId, user);
    await this.access.assertProjectActive(doc.projectId);

    const src = await this.prisma.documentVersion.findFirst({ where: { id: versionId, documentId: docId } });
    if (!src) throw new NotFoundException('Không tìm thấy phiên bản nguồn.');

    const last = await this.prisma.documentVersion.findFirst({
      where: { documentId: docId },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true },
    });
    const newVersionNo = (last?.versionNo ?? 0) + 1;

    // Copy file vật lý trên MinIO
    const buffer = await this.storage.getObjectBuffer(src.storageKey);
    const newKey = `projects/${doc.projectId}/${docId}/v${newVersionNo}_restored_${src.fileType}`;
    await this.storage.putObject(newKey, buffer);

    let newRawKey: string | null = null;
    if (src.rawTextStorageKey) {
      const rawBuf = await this.storage.getObjectBuffer(src.rawTextStorageKey);
      newRawKey = `${newKey}.txt`;
      await this.storage.putObject(newRawKey, rawBuf, 'text/plain; charset=utf-8');
    }

    const created = await this.prisma.documentVersion.create({
      data: {
        documentId: docId,
        versionNo: newVersionNo,
        storageKey: newKey,
        rawTextStorageKey: newRawKey,
        fileType: src.fileType,
        fileSize: src.fileSize,
        textExtracted: !!newRawKey,
        commitMessage: `Khôi phục từ phiên bản v${src.versionNo}.0`,
        uploadedBy: user.sub,
      },
    });
    await this.audit.log({ action: 'VERSION_RESTORE', userId: user.sub, targetId: docId, isSuccess: true, metadata: { from: src.versionNo, to: newVersionNo } });
    return {
      newVersionId: created.id,
      versionNo: newVersionNo,
      message: `Đã khôi phục thành công nội dung từ phiên bản cũ. Hệ thống đã sinh ra phiên bản v${newVersionNo}.0.`,
    };
  }

  // C1 (Phase 5): Preview URL — inline disposition, KHÔNG audit DOWNLOAD vì chỉ là view inline.
  // Vẫn check clearance ABAC như download. Không trigger anomaly counter (vì preview thường spam).
  async getPreviewUrl(docId: string, versionId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { projectId: true, securityLevel: true },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.access.assertMember(doc.projectId, user);

    // ABAC clearance gate (giống download)
    this.access.assertClearance(user.clearanceLevel, doc.securityLevel);

    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId: docId },
      select: { storageKey: true, fileType: true },
    });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản.');

    const previewUrl = await this.storage.getPresignedPreviewUrl(version.storageKey, version.fileType, 300);
    return { previewUrl, fileType: version.fileType, expiresIn: 300 };
  }

  // --- Luồng 16: Download (presigned + ABAC clearance + Anomaly detection) ---
  async getDownloadUrl(docId: string, versionId: string, user: AuthenticatedUser, ip: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { projectId: true, securityLevel: true },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.access.assertMember(doc.projectId, user);

    // Zero-Trust ABAC: clearance phải đủ
    try {
      this.access.assertClearance(user.clearanceLevel, doc.securityLevel);
    } catch (e) {
      await this.audit.log({ action: 'DOWNLOAD_DENIED', userId: user.sub, targetId: docId, ipAddress: ip, isSuccess: false, failReason: 'Clearance không đủ' });
      throw e;
    }

    await this.assertNotAnomalous(user.sub, docId);

    const version = await this.prisma.documentVersion.findFirst({ where: { id: versionId, documentId: docId } });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản.');

    const downloadUrl = await this.storage.getPresignedDownloadUrl(version.storageKey, 300);
    await this.audit.log({ action: 'DOWNLOAD_SUCCESS', userId: user.sub, targetId: docId, ipAddress: ip, isSuccess: true });
    return { downloadUrl, expiresIn: 300, message: 'Link tải xuống có hiệu lực trong 5 phút.' };
  }

  // Sliding Window (Redis ZSET): cảnh báo nếu tải > N tài liệu/phút
  private async assertNotAnomalous(userId: string, docId: string): Promise<void> {
    const key = `user:download_freq:${userId}`;
    const now = Date.now();
    await this.redis.client.zadd(key, now, `${docId}:${now}`);
    await this.redis.client.zremrangebyscore(key, 0, now - 60_000);
    await this.redis.client.expire(key, 120);
    const count = await this.redis.client.zcard(key);
    if (count > this.anomalyThreshold) {
      await this.audit.log({
        action: 'SECURITY_ALERT',
        userId,
        targetId: docId,
        isSuccess: false,
        failReason: `Tải ${count} tài liệu trong 1 phút (ngưỡng ${this.anomalyThreshold})`,
      });
      throw new HttpException('Bạn đang tải xuống quá nhanh. Vui lòng thử lại sau.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
