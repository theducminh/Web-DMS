import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';
import { MAILER_QUEUE } from '../../infra/queue/queue.module';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DocumentAccessService } from '../documents/document-access.service';
import { ReviewDecisionDto } from './dto/review.dto';

/**
 * Finite State Machine vòng đời tài liệu (Luồng 17 / FR-2.3.1):
 *   DRAFT --submit--> UNDER_REVIEW --approve--> RELEASED
 *                                   --reject--> DRAFT
 * Kèm Hard Lock khi review, Hash Chaining audit, và thông báo email qua BullMQ.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly access: DocumentAccessService,
    @InjectQueue(MAILER_QUEUE) private readonly mailerQueue: Queue,
  ) {}

  private lockKey(docId: string): string {
    return `doc:lock:${docId}`;
  }

  // --- Contributor gửi yêu cầu phê duyệt: DRAFT -> UNDER_REVIEW ---
  async submitForReview(docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { projectId: true, status: true, isDeleted: true },
    });
    if (!doc || doc.isDeleted) throw new NotFoundException('Không tìm thấy tài liệu.');
    await this.access.assertCanEdit(doc.projectId, user);
    await this.access.assertProjectActive(doc.projectId);

    if (doc.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể gửi duyệt tài liệu đang ở trạng thái DRAFT.');
    }

    await this.prisma.document.update({ where: { id: docId }, data: { status: 'UNDER_REVIEW' } });
    // Systemic Hard Lock: khóa biên tập trong lúc chờ duyệt (giá trị 'SYSTEM')
    await this.redis.client.set(this.lockKey(docId), 'SYSTEM', 'EX', Number(process.env.DOC_LOCK_TTL_SECONDS ?? 7200));

    await this.audit.log({ action: 'SUBMIT_REVIEW', userId: user.sub, targetId: docId, isSuccess: true });

    // Thông báo PM dự án (BullMQ) — gửi tới owner dự án
    const project = await this.prisma.project.findUnique({
      where: { id: doc.projectId },
      select: { owner: { select: { email: true } }, name: true },
    });
    const docMeta = await this.prisma.document.findUnique({ where: { id: docId }, select: { title: true } });
    if (project?.owner?.email) {
      await this.mailerQueue.add('sendReviewResult', {
        to: project.owner.email,
        documentTitle: docMeta?.title ?? 'Tài liệu',
        decision: 'SUBMITTED',
        reason: `Có tài liệu mới cần duyệt trong dự án ${project.name}.`,
        reviewerName: user.fullName ?? user.email,
      });
    }

    return { newStatus: 'UNDER_REVIEW', message: 'Đã gửi yêu cầu phê duyệt. Tài liệu hiện đang bị khóa chờ PM xử lý.' };
  }

  // --- PM/Reviewer quyết định: APPROVE -> RELEASED | REJECT -> DRAFT ---
  async review(docId: string, dto: ReviewDecisionDto, user: AuthenticatedUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      select: { projectId: true, status: true, isDeleted: true, title: true, createdBy: true },
    });
    if (!doc || doc.isDeleted) throw new NotFoundException('Không tìm thấy tài liệu.');

    // Chỉ PM/Reviewer/Admin được duyệt
    const role = await this.access.getProjectRole(doc.projectId, user);
    if (!['ADMIN', 'PM', 'REVIEWER'].includes(role ?? '')) {
      throw new ForbiddenException('Chỉ PM hoặc Reviewer mới được phê duyệt tài liệu.');
    }

    // FSM: chỉ xử lý khi đang UNDER_REVIEW
    if (doc.status !== 'UNDER_REVIEW') {
      throw new BadRequestException('Tài liệu không ở trạng thái chờ duyệt.');
    }

    if (dto.action === 'REJECT' && (!dto.comment || dto.comment.trim().length < 10)) {
      throw new BadRequestException('Bắt buộc nhập lý do từ chối (tối thiểu 10 ký tự).');
    }

    let newStatus: 'RELEASED' | 'DRAFT';
    if (dto.action === 'APPROVE') {
      // Phiên bản mới nhất trở thành bản phát hành chuẩn (SSOT)
      const latest = await this.prisma.documentVersion.findFirst({
        where: { documentId: docId },
        orderBy: { versionNo: 'desc' },
        select: { id: true },
      });
      await this.prisma.document.update({
        where: { id: docId },
        data: { status: 'RELEASED', publishedVersionId: latest?.id ?? null, lockedBy: null },
      });
      newStatus = 'RELEASED';
    } else {
      await this.prisma.document.update({ where: { id: docId }, data: { status: 'DRAFT', lockedBy: null } });
      newStatus = 'DRAFT';
    }

    // Giải phóng Hard Lock + cache quyền
    await this.redis.client.del(this.lockKey(docId));

    await this.audit.log({
      action: dto.action === 'APPROVE' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
      userId: user.sub,
      targetId: docId,
      isSuccess: true,
      metadata: { comment: dto.comment ?? null, newStatus },
    });

    // Thông báo tác giả (BullMQ)
    const author = await this.prisma.profile.findUnique({ where: { id: doc.createdBy }, select: { email: true } });
    if (author?.email) {
      await this.mailerQueue.add('sendReviewResult', {
        to: author.email,
        documentTitle: doc.title,
        decision: dto.action,
        reason: dto.comment,
        reviewerName: user.fullName ?? user.email,
      });
    }

    return {
      newStatus,
      message:
        dto.action === 'APPROVE'
          ? 'Đã phê duyệt và phát hành tài liệu (RELEASED).'
          : 'Đã từ chối phê duyệt tài liệu và chuyển về trạng thái Draft.',
    };
  }
}
