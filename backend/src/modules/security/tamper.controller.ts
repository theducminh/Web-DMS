import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AdminGuard } from '../../core/guards/admin.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { LockdownService } from './lockdown.service';
import { IntegrityService } from './integrity.service';
import { SecurityAuditService } from './audit.service';
import { LockdownDto } from './dto/security.dto';

/** Luồng 25 — Tamper Detection Hub + Emergency Lockdown. */
@ApiTags('admin-security')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/security')
export class TamperController {
  constructor(
    private readonly lockdown: LockdownService,
    private readonly integrity: IntegrityService,
    private readonly audit: SecurityAuditService,
  ) {}

  // Banner trạng thái + danh sách cảnh báo recent
  @Get('alerts')
  alerts() {
    return this.audit.listSecurityAlerts(50);
  }

  // Hash Chain integrity
  @Post('trigger-verify')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerVerify(@CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    return this.integrity.triggerScan(admin, this.ip(req));
  }

  @Get('verify-integrity')
  verifyStatus() {
    return this.integrity.getStatus();
  }

  // Emergency Lockdown
  @Get('lockdown/status')
  lockdownStatus() {
    return this.lockdown.getStatus();
  }

  @Post('lockdown')
  @HttpCode(HttpStatus.OK)
  doLockdown(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: LockdownDto,
    @Req() req: Request,
  ) {
    return this.lockdown.lockdown(dto, admin, req.cookies?.['refresh_token'], this.ip(req));
  }

  @Post('lockdown/release')
  @HttpCode(HttpStatus.OK)
  releaseLockdown(@CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    return this.lockdown.release(admin, this.ip(req));
  }

  private ip(req: Request): string {
    return (req.ip ?? '').replace('::ffff:', '');
  }
}
