import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { MinioS3Service } from '../../infra/storage/minio-s3.service';
import { RedisService } from '../../infra/cache/redis.service';
import { DocumentFileType } from './document-validator.service';

/**
 * F4 (Phase 6) — SOLID Refactor: tách Storage + Versioning khỏi DocumentsService.
 *
 * SRP: Class này chỉ thay đổi khi cách lưu trữ tài liệu vật lý hoặc cách
 * đánh số version thay đổi (vd: chuyển từ MinIO sang S3, đổi format storageKey).
 *
 * DIP (Dependency Inversion): DocumentsService phụ thuộc vào abstraction này
 * (interface mặc nhiên qua TypeScript types) thay vì phụ thuộc trực tiếp vào
 * PrismaService + MinioS3Service. Test sẽ dễ mock hơn.
 *
 * ISP (Interface Segregation): Tách rõ 2 nhóm method:
 *   - getNextVersionNo (read-only, snapshot semantic)
 *   - storeAndCreateVersion (write transactional)
 */
export interface VersionCreationInput {
  documentId: string;
  projectId: string;
  fileType: DocumentFileType;
  fileBuffer: Buffer;
  fileSize: number;
  originalName: string;
  mimeType: string;
  commitMessage?: string | null;
  uploadedBy: string;
}

@Injectable()
export class DocumentVersionFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioS3Service,
    private readonly redis: RedisService,
  ) {}

  /**
   * Sinh versionNo kế tiếp theo nguyên tắc append-only (max + 1).
   * Không dùng auto-increment DB vì version scope theo document, không global.
   */
  async getNextVersionNo(documentId: string): Promise<number> {
    const last = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true },
    });
    return (last?.versionNo ?? 0) + 1;
  }

  /**
   * Push file lên MinIO (SSE-S3) -> tạo DocumentVersion row -> reset doc về DRAFT
   * (giải phóng khóa cộng tác).
   *
   * StorageKey schema: projects/{projectId}/{documentId}/v{N}_{safeFileName}
   *   - prefix projects/{id} cho phép policy MinIO bucket-level
   *   - safeFileName loại bỏ ký tự đặc biệt -> tránh URL encoding mất ổn định
   */
  async storeAndCreateVersion(input: VersionCreationInput): Promise<{ id: string; versionNo: number; storageKey: string }> {
    const versionNo = await this.getNextVersionNo(input.documentId);
    const safeName = input.originalName.replace(/[^\w.\-]+/g, '_');
    const storageKey = `projects/${input.projectId}/${input.documentId}/v${versionNo}_${safeName}`;

    await this.storage.putObject(storageKey, input.fileBuffer, input.mimeType);

    const version = await this.prisma.documentVersion.create({
      data: {
        documentId: input.documentId,
        versionNo,
        storageKey,
        fileType: input.fileType,
        fileSize: BigInt(input.fileSize),
        commitMessage: input.commitMessage ?? null,
        uploadedBy: input.uploadedBy,
        textExtracted: false,
      },
    });

    // Upload đè -> tài liệu quay về DRAFT, giải phóng khóa cộng tác
    await this.prisma.document.update({
      where: { id: input.documentId },
      data: { status: 'DRAFT', lockedBy: null },
    });
    await this.redis.client.del(`doc:lock:${input.documentId}`);

    return { id: version.id, versionNo, storageKey };
  }
}
