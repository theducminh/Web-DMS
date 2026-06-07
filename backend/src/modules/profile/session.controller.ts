import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';

/**
 * Quản lý phiên làm việc (Luồng 6 — Account Security).
 * Phiên "hiện tại" được nhận diện qua jti của refresh_token trong HttpOnly cookie.
 */
@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile/sessions')
export class SessionController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  async list(@CurrentUser('sub') userId: string, @Req() req: Request) {
    const currentJti = await this.auth.getRefreshJti(req.cookies?.['refresh_token']);
    return this.auth.listSessions(userId, currentJti);
  }

  @Delete('others')
  @HttpCode(HttpStatus.OK)
  async revokeOthers(@CurrentUser('sub') userId: string, @Req() req: Request) {
    const currentJti = await this.auth.getRefreshJti(req.cookies?.['refresh_token']);
    await this.auth.revokeOtherSessions(userId, currentJti);
    return { message: 'Đã đăng xuất toàn bộ các thiết bị khác.' };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  async revoke(@CurrentUser('sub') userId: string, @Param('sessionId') sessionId: string) {
    await this.auth.revokeSession(userId, sessionId);
    return { message: 'Đã hủy phiên làm việc thành công.' };
  }
}
