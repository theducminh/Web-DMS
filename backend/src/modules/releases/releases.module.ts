import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';

/**
 * ReleasesModule [Luồng 19, 20] — chốt hồ sơ (Immutable Snapshot), chấm tuân thủ,
 * export gói .zip qua BullMQ archiver.
 * Import ProjectsModule (assertManager) + DocumentsModule (DocumentAccessService).
 */
@Module({
  imports: [ProjectsModule, DocumentsModule],
  controllers: [ReleasesController],
  providers: [ReleasesService],
})
export class ReleasesModule {}
