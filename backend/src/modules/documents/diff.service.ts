import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/database/prisma.service';
import { MinioS3Service } from '../../infra/storage/minio-s3.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DocumentAccessService } from './document-access.service';

/**
 * Luồng 18 — Hybrid Visual Diff. NestJS điều phối: tạo presigned URL cho 2 bản gốc
 * (chế độ Original) và gửi presigned URL của 2 raw_text sang Diff Engine microservice
 * (FastAPI) để tính delta (chế độ Text Diff), tránh tải CPU lên Node.
 */
@Injectable()
export class DiffService {
  private readonly diffEngineUrl = process.env.DIFF_ENGINE_URL ?? 'http://diff-engine:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioS3Service,
    private readonly audit: AuditService,
    private readonly access: DocumentAccessService,
  ) {}

  async getDiff(docId: string, v1No: number, v2No: number, user: AuthenticatedUser) {
    if (v1No === v2No) throw new BadRequestException('Vui lòng chọn hai phiên bản khác nhau.');

    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { projectId: true, securityLevel: true, versions: false },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');

    await this.access.assertMember(doc.projectId, user);
    // Double-Gate clearance: phải đủ thẩm quyền với mức mật của tài liệu
    this.access.assertClearance(user.clearanceLevel, doc.securityLevel);

    const [v1, v2] = await Promise.all([
      this.prisma.documentVersion.findFirst({
        where: { documentId: docId, versionNo: v1No },
        include: { uploader: { select: { fullName: true } } },
      }),
      this.prisma.documentVersion.findFirst({
        where: { documentId: docId, versionNo: v2No },
        include: { uploader: { select: { fullName: true } } },
      }),
    ]);
    if (!v1 || !v2) throw new NotFoundException('Không tìm thấy phiên bản để so sánh.');

    const [v1Url, v2Url] = await Promise.all([
      this.storage.getPresignedDownloadUrl(v1.storageKey, 300),
      this.storage.getPresignedDownloadUrl(v2.storageKey, 300),
    ]);

    // Text Diff qua Diff Engine (nếu cả 2 bản đã bóc tách text)
    let statistics = { additions: 0, deletions: 0 };
    let diffDeltas: unknown[] = [];
    let diffAvailable = false;

    if (v1.rawTextStorageKey && v2.rawTextStorageKey) {
      // Diff Engine chạy trong network -> dùng INTERNAL presigned URL (host=minio:9000)
      const [rawUrl1, rawUrl2] = await Promise.all([
        this.storage.getInternalPresignedUrl(v1.rawTextStorageKey, 300),
        this.storage.getInternalPresignedUrl(v2.rawTextStorageKey, 300),
      ]);
      const resp = await fetch(`${this.diffEngineUrl}/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v1_url: rawUrl1, v2_url: rawUrl2 }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { statistics: typeof statistics; diffDeltas: unknown[] };
        statistics = data.statistics;
        diffDeltas = data.diffDeltas;
        diffAvailable = true;
      }
    }

    await this.audit.log({ action: 'DOCUMENT_DIFF', userId: user.sub, targetId: docId, isSuccess: true, metadata: { v1: v1No, v2: v2No } });

    return {
      documentId: docId,
      meta: {
        v1: { versionNo: v1.versionNo, author: v1.uploader.fullName },
        v2: { versionNo: v2.versionNo, author: v2.uploader.fullName },
      },
      originalUrls: { v1Url, v2Url },
      diffAvailable,
      statistics,
      diffDeltas,
    };
  }
}
