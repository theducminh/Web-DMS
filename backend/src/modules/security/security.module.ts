import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditLogController } from './audit.controller';
import { TamperController } from './tamper.controller';
import { SecurityAuditService } from './audit.service';
import { LockdownService } from './lockdown.service';
import { IntegrityService } from './integrity.service';
import { AdminGuard } from '../../core/guards/admin.guard';

/**
 * SecurityModule [Luồng 23, 24, 25] — Audit Ledger Dashboard, Compliance Export
 * (CSV streaming / PDF watermark + signature), Tamper Detection Hub + Integrity
 * Scanner (BullMQ), Emergency Lockdown.
 */
@Module({
  imports: [AuthModule],
  controllers: [AuditLogController, TamperController],
  providers: [SecurityAuditService, LockdownService, IntegrityService, AdminGuard],
})
export class SecurityModule {}
