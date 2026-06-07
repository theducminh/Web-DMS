import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

export interface AuditEntry {
  action: string;
  userId?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  isSuccess?: boolean;
  failReason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Ghi nhật ký kiểm toán (Append-only). KHÔNG tự tính hash ở đây:
 * trigger DB `compute_audit_hash` tự điền previous_hash/current_hash (Hash Chaining).
 * Ghi log không bao giờ được làm sập luồng nghiệp vụ chính -> nuốt lỗi và log cảnh báo.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId ?? null,
          targetId: entry.targetId ?? null,
          ipAddress: entry.ipAddress ?? null,
          isSuccess: entry.isSuccess ?? true,
          failReason: entry.failReason ?? null,
          metadata: (entry.metadata ?? undefined) as any,
        },
      });
    } catch (err) {
      this.logger.error(`Ghi audit log thất bại (action=${entry.action})`, err as Error);
    }
  }
}
