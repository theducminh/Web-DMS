import { SetMetadata } from '@nestjs/common';

/** Đánh dấu route không cần xác thực JWT (VD: login, register, forgot-password). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
