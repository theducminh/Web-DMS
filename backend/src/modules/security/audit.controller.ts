import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AdminGuard } from '../../core/guards/admin.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { SecurityAuditService } from './audit.service';
import { ExportAuditDto, QueryAuditDto } from './dto/security.dto';

/** Luồng 23, 24 — Audit Ledger Dashboard + Compliance Export. */
@ApiTags('admin-security')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly audit: SecurityAuditService) {}

  @Get()
  list(@Query() q: QueryAuditDto) {
    return this.audit.queryLogs(q);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async export(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ExportAuditDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const ip = (req.ip ?? '').replace('::ffff:', '');
    if (dto.format === 'CSV') return this.audit.exportCsv(dto, admin, ip, res);
    return this.audit.exportPdf(dto, admin, ip, res);
  }
}
