import { createHash } from 'node:crypto';

/**
 * Định dạng payload SHA-256 KHỚP ĐÚNG trigger DB `compute_audit_hash` (Hash Chaining FR-5.2):
 *   payload = prev_hash || id || ts || user_id || action || target_id
 *           || ip || is_success || fail_reason || metadata::text
 * Mọi trường NULL được COALESCE thành chuỗi rỗng; timestamp định dạng
 *   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' (giờ UTC, microsecond) — cần truyền vào sẵn.
 */
export interface AuditHashRow {
  idStr: string;
  tsStr: string;
  userIdStr: string;
  actionStr: string;
  targetIdStr: string;
  ipStr: string;
  successStr: string;
  failStr: string;
  metaStr: string;
}

export function computeAuditHash(prevHash: string, row: AuditHashRow): string {
  const payload =
    prevHash + row.idStr + row.tsStr + row.userIdStr + row.actionStr + row.targetIdStr +
    row.ipStr + row.successStr + row.failStr + row.metaStr;
  return createHash('sha256').update(payload).digest('hex');
}
