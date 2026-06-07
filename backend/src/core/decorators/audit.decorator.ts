import { SetMetadata } from '@nestjs/common';

/**
 * Đánh dấu một route cần ghi Audit Log tự động (AuditHashInterceptor sẽ bắt).
 * action: mã hành động (VD: 'DOCUMENT_UPLOAD', 'PROJECT_ARCHIVE').
 */
export const AUDIT_ACTION_KEY = 'auditAction';
export const Audit = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
