import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { RedisService } from '../../infra/cache/redis.service';
import { INTEGRITY_SCAN_QUEUE } from '../../infra/queue/queue.module';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';

/**
 * Quản lý quét toàn vẹn Hash Chain audit_logs (Luồng 25, FR-5.2).
 * Trigger qua BullMQ (worker thật quét); API chỉ enqueue + đọc kết quả từ Redis.
 */
@Injectable()
export class IntegrityService {
  constructor(
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @InjectQueue(INTEGRITY_SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {}

  async triggerScan(admin: AuthenticatedUser, ip: string) {
    await this.scanQueue.add('scan', { triggeredBy: admin.sub, at: new Date().toISOString() });
    await this.audit.log({ action: 'INTEGRITY_SCAN_REQUEST', userId: admin.sub, ipAddress: ip, isSuccess: true });
    return { status: 'PROCESSING', message: 'Đã ghi nhận yêu cầu quét. Vui lòng kiểm tra trạng thái sau giây lát.' };
  }

  async getStatus() {
    const raw = await this.redis.client.get('integrity:last-scan');
    if (!raw) return { status: 'NO_SCAN', message: 'Chưa có kết quả quét. Hãy bấm Kiểm tra ngay.' };
    return JSON.parse(raw);
  }
}
