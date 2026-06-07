import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { INTEGRITY_SCAN_QUEUE } from '../infra/queue/queue.module';
import { PrismaService } from '../infra/database/prisma.service';
import { RedisService } from '../infra/cache/redis.service';
import { computeAuditHash, AuditHashRow } from '../shared/utils/hash-chain.util';

interface RawRow extends AuditHashRow {
  rowId: string;
  current_hash: string;
  previous_hash: string;
}

/**
 * Quét toàn bộ audit_logs xác minh Hash Chaining (FR-5.2). Dùng Keyset Pagination
 * (batch 1000 theo id) để không OOM. Kết quả ghi Redis `integrity:last-scan` để
 * API trả về cho Tamper Hub (Luồng 25). Nếu phát hiện đứt gãy: status COMPROMISED.
 */
@Processor(INTEGRITY_SCAN_QUEUE)
export class IntegrityCheckerProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrityCheckerProcessor.name);
  private readonly BATCH = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Bắt đầu quét toàn vẹn audit_logs...');
    let lastId = 0n;
    let scanned = 0;
    const allHashes = new Set<string>();
    allHashes.add('GENESIS');
    let corrupted: { id: string; expected: string; actual: string; reason: string } | null = null;

    while (true) {
      const rows = await this.prisma.$queryRawUnsafe<RawRow[]>(
        `SELECT id::text AS "rowId",
                id::text AS "idStr",
                to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "tsStr",
                COALESCE(user_id::text, '') AS "userIdStr",
                COALESCE(action, '') AS "actionStr",
                COALESCE(target_id, '') AS "targetIdStr",
                COALESCE(ip_address, '') AS "ipStr",
                COALESCE(is_success::text, '') AS "successStr",
                COALESCE(fail_reason, '') AS "failStr",
                COALESCE(metadata::text, '') AS "metaStr",
                current_hash, previous_hash
         FROM audit_logs
         WHERE id > ${lastId}::bigint
         ORDER BY id ASC
         LIMIT ${this.BATCH}`,
      );
      if (rows.length === 0) break;

      for (const row of rows) {
        // Per-row check: dùng STORED previous_hash + nội dung row để tính lại current_hash.
        // Bằng cách này không phụ thuộc thứ tự chèn (trigger DB chọn prev theo (timestamp,id)
        // có thể không trùng id ASC). Nếu kẻ tấn công sửa bất kỳ trường nào -> mismatch.
        const expected = computeAuditHash(row.previous_hash, row);
        if (expected !== row.current_hash) {
          corrupted = {
            id: row.rowId,
            expected,
            actual: row.current_hash,
            reason: 'Hash row không khớp dữ liệu hiện tại (đã bị sửa nội dung).',
          };
          break;
        }
        allHashes.add(row.current_hash);
        scanned++;
      }
      if (corrupted) break;
      lastId = BigInt(rows[rows.length - 1].rowId);
    }

    // Chain continuity: previous_hash của mọi row phải tồn tại trong tập current_hash đã thấy.
    if (!corrupted) {
      const all = await this.prisma.auditLog.findMany({ select: { id: true, previousHash: true } });
      for (const r of all) {
        if (!allHashes.has(r.previousHash)) {
          corrupted = {
            id: r.id.toString(),
            expected: '<link to existing hash>',
            actual: r.previousHash,
            reason: 'previous_hash không tham chiếu được dòng nào (mắt xích chuỗi bị xóa/đảo).',
          };
          break;
        }
      }
    }

    const result = corrupted
      ? {
          status: 'COMPROMISED' as const,
          corruptedRowId: corrupted.id,
          reason: corrupted.reason,
          scannedRows: scanned,
          finishedAt: new Date().toISOString(),
        }
      : { status: 'SECURE' as const, scannedRows: scanned, finishedAt: new Date().toISOString() };

    await this.redis.client.set('integrity:last-scan', JSON.stringify(result), 'EX', 3600);
    this.logger.log(`Quét xong: ${result.status} (đã quét ${scanned} dòng).`);
  }
}
