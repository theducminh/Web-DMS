import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';
import { MinioS3Service } from '../../infra/storage/minio-s3.service';
import { RELEASE_EXPORT_QUEUE } from '../../infra/queue/queue.module';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ProjectsService } from '../projects/projects.service';
import { DocumentAccessService } from '../documents/document-access.service';
import { CreateReleaseDto } from './dto/releases.dto';

@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: MinioS3Service,
    private readonly audit: AuditService,
    private readonly projects: ProjectsService,
    private readonly access: DocumentAccessService,
    @InjectQueue(RELEASE_EXPORT_QUEUE) private readonly exportQueue: Queue,
  ) {}

  // --- Luồng 19: Danh sách đợt phát hành ---
  async list(projectId: string, user: AuthenticatedUser) {
    await this.access.assertMember(projectId, user);
    const releases = await this.prisma.release.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { documentVersions: true } } },
    });
    return releases.map((r) => ({
      id: r.id,
      releaseName: r.releaseName,
      status: r.status,
      complianceScore: r.complianceScore,
      templateType: r.templateType,
      documentCount: r._count.documentVersions,
      frozenAt: r.frozenAt,
      createdAt: r.createdAt,
    }));
  }

  // --- Luồng 19: Khởi tạo đợt chốt hồ sơ (Immutable Snapshot + chấm tuân thủ) ---
  async create(projectId: string, dto: CreateReleaseDto, user: AuthenticatedUser) {
    await this.projects.assertManager(projectId, user);

    // Snapshot: các tài liệu đang RELEASED tại thời điểm chốt
    const releasedDocs = await this.prisma.document.findMany({
      where: { projectId, isDeleted: false, status: 'RELEASED', publishedVersionId: { not: null } },
      select: { id: true, publishedVersionId: true, folderId: true, title: true },
    });

    const { status, complianceScore } = await this.scoreCompliance(projectId, dto.templateType, releasedDocs);

    const release = await this.prisma.$transaction(async (tx) => {
      const r = await tx.release.create({
        data: {
          projectId,
          releaseName: dto.releaseName,
          templateType: dto.templateType,
          description: dto.description,
          status,
          complianceScore,
          frozenAt: new Date(),
          createdBy: user.sub,
        },
      });
      for (const d of releasedDocs) {
        await tx.releaseDocumentVersion.create({
          data: { releaseId: r.id, documentVersionId: d.publishedVersionId! },
        });
      }
      return r;
    });

    await this.audit.log({
      action: 'RELEASE_INITIALIZED',
      userId: user.sub,
      targetId: release.id,
      isSuccess: true,
      metadata: { releaseName: dto.releaseName, status, complianceScore, snapshotCount: releasedDocs.length },
    });

    return {
      id: release.id,
      status,
      complianceScore,
      message: 'Đã ghi nhận lệnh chốt hồ sơ. Hệ thống đã đóng băng và quét tuân thủ.',
    };
  }

  // Chấm điểm: mỗi thư mục template gốc (is_locked) phải có ÍT NHẤT 1 tài liệu RELEASED
  // BÊN TRONG (kể cả subfolder đệ quy). VD: 01_SRS/Vong_1/srs.pdf cũng tính cho 01_SRS.
  private async scoreCompliance(
    projectId: string,
    templateType: string | undefined,
    releasedDocs: { folderId: string | null; title: string }[],
  ): Promise<{ status: 'VERIFIED' | 'VIOLATED'; complianceScore: number; passed: number; total: number }> {
    if (!templateType) return { status: 'VERIFIED', complianceScore: 100, passed: 0, total: 0 };

    const tmpl = await this.prisma.projectTemplate.findUnique({
      where: { templateType },
      include: { folders: true },
    });
    const required = (tmpl?.folders ?? []).filter((f) => f.parentPath === null && f.isLocked);
    if (required.length === 0) return { status: 'VERIFIED', complianceScore: 100, passed: 0, total: 0 };

    let passed = 0;
    for (const rf of required) {
      const rootFolder = await this.prisma.folder.findFirst({
        where: { projectId, parentId: null, name: rf.name },
        select: { id: true },
      });
      if (!rootFolder) continue;

      // Lấy CẢ CÂY descendant (BFS) — fix bug: doc trong subfolder cũng tính
      const subtreeIds = await this.collectFolderSubtree(projectId, rootFolder.id);

      if (releasedDocs.some((d) => d.folderId && subtreeIds.has(d.folderId))) {
        passed++;
      }
    }
    const total = required.length;
    return {
      status: passed === total ? 'VERIFIED' : 'VIOLATED',
      complianceScore: Math.round((passed / total) * 100),
      passed,
      total,
    };
  }

  /** BFS: trả về Set chứa folderId của root + tất cả descendants. */
  private async collectFolderSubtree(projectId: string, rootId: string): Promise<Set<string>> {
    const ids = new Set<string>([rootId]);
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.folder.findMany({
        where: { projectId, parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id).filter((id) => !ids.has(id));
      frontier.forEach((id) => ids.add(id));
    }
    return ids;
  }

  // --- Luồng 20: Compliance Checklist (từ Snapshot đã đóng băng) ---
  async getCompliance(projectId: string, releaseId: string, user: AuthenticatedUser) {
    await this.access.assertMember(projectId, user);
    const release = await this.prisma.release.findFirst({ where: { id: releaseId, projectId } });
    if (!release) throw new NotFoundException('Không tìm thấy đợt phát hành.');

    const snapshot = await this.prisma.releaseDocumentVersion.findMany({
      where: { releaseId },
      include: {
        documentVersion: {
          include: {
            document: {
              select: { title: true, status: true, folderId: true, folder: { select: { name: true } } },
            },
          },
        },
      },
    });

    let required: { name: string }[] = [];
    if (release.templateType) {
      const tmpl = await this.prisma.projectTemplate.findUnique({
        where: { templateType: release.templateType },
        include: { folders: true },
      });
      required = (tmpl?.folders ?? []).filter((f) => f.parentPath === null && f.isLocked).map((f) => ({ name: f.name }));
    }

    // Pre-compute subtree cho mỗi root template folder → check doc thuộc cây này (đệ quy)
    const subtreeByRoot = new Map<string, Set<string>>();
    for (const rf of required) {
      const rootFolder = await this.prisma.folder.findFirst({
        where: { projectId, parentId: null, name: rf.name },
        select: { id: true },
      });
      if (rootFolder) {
        subtreeByRoot.set(rf.name, await this.collectFolderSubtree(projectId, rootFolder.id));
      } else {
        subtreeByRoot.set(rf.name, new Set());
      }
    }

    const checklist = required.map((rf) => {
      const subtreeIds = subtreeByRoot.get(rf.name) ?? new Set<string>();
      const entry = snapshot.find(
        (s) => s.documentVersion.document.folderId && subtreeIds.has(s.documentVersion.document.folderId),
      );
      return {
        requiredCategory: rf.name,
        mappedDocument: entry?.documentVersion.document.title ?? null,
        docStatus: entry ? entry.documentVersion.document.status : 'MISSING',
        compliant: !!entry,
      };
    });
    const passed = checklist.filter((c) => c.compliant).length;

    return {
      releaseId,
      releaseName: release.releaseName,
      templateApplied: release.templateType,
      status: release.status,
      isCompliant: release.status === 'VERIFIED',
      summary: { totalRequired: required.length, passed, failed: required.length - passed },
      checklist,
    };
  }

  // --- Luồng 20: Yêu cầu Export (BullMQ archiver) ---
  // Export được phép cả khi project đã ARCHIVED — vì release là immutable snapshot
  // tại thời điểm chốt, không phụ thuộc trạng thái project hiện tại.
  async requestExport(projectId: string, releaseId: string, user: AuthenticatedUser) {
    // Member của project (kể cả khi archived) đều xin export được, không cần PM-only
    await this.access.assertMember(projectId, user);
    const release = await this.prisma.release.findFirst({ where: { id: releaseId, projectId } });
    if (!release) throw new NotFoundException('Không tìm thấy đợt phát hành.');
    if (release.status !== 'VERIFIED') {
      throw new BadRequestException('Chỉ được xuất hồ sơ khi đợt phát hành đạt tuân thủ 100% (VERIFIED).');
    }

    await this.exportQueue.add('export', { releaseId, projectId });
    await this.audit.log({ action: 'RELEASE_EXPORT_REQUEST', userId: user.sub, targetId: releaseId, isSuccess: true });
    return { status: 'PROCESSING', message: 'Hệ thống đang nén tệp tin và đóng gói hồ sơ. Vui lòng kiểm tra lại sau giây lát.' };
  }

  // --- Luồng 20: Kiểm tra/Lấy link gói đã nén ---
  async getExport(projectId: string, releaseId: string, user: AuthenticatedUser) {
    await this.access.assertMember(projectId, user);
    const zipKey = await this.redis.client.get(`release:export:${releaseId}`);
    if (!zipKey) return { status: 'PROCESSING', message: 'Gói hồ sơ đang được đóng gói.' };

    const downloadUrl = await this.storage.getPresignedDownloadUrl(zipKey, 300);
    await this.audit.log({ action: 'RELEASE_EXPORT_DOWNLOAD', userId: user.sub, targetId: releaseId, isSuccess: true });
    return { status: 'READY', downloadUrl, expiresIn: 300 };
  }
}
