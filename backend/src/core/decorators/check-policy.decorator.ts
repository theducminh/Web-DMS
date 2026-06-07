import { SetMetadata } from '@nestjs/common';

/**
 * Khai báo action ABAC cho CasbinAbacGuard (ghi đè action mặc định = HTTP method).
 * VD: @CheckPolicy('DOWNLOAD') trên endpoint tải tài liệu.
 */
export const POLICY_ACTION_KEY = 'policyAction';
export const CheckPolicy = (action: string) => SetMetadata(POLICY_ACTION_KEY, action);
