import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { AdminGuard } from '../../core/guards/admin.guard';

/** TemplatesModule [Luồng 26] — Master Data Project Templates cho Admin. */
@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, AdminGuard],
})
export class TemplatesModule {}
