import { Module } from '@nestjs/common';

import { FoldersController } from './folders.controller';
import { DocumentUploadController } from './document-upload.controller';
import { DocumentsController } from './documents.controller';
import { DiffController } from './diff.controller';

import { DocumentAccessService } from './document-access.service';
import { FoldersService } from './folders.service';
import { DocumentsService } from './documents.service';
import { DiffService } from './diff.service';
import { DocumentValidator } from './document-validator.service';
import { DocumentVersionFactory } from './document-version.factory';
import { AuthModule } from '../auth/auth.module';

/**
 * DocumentsModule [Luồng 12, 15, 16, 18] — Folder Navigator, Upload (MinIO SSE +
 * BullMQ extraction), Document Dashboard/Download, Hybrid Visual Diff.
 * (QueueModule global cung cấp queue 'text-extraction' để enqueue job.)
 */
@Module({
  imports: [AuthModule], // D4 (Phase 5): để dùng MailService gửi notification "xin trả khóa"
  controllers: [FoldersController, DocumentUploadController, DocumentsController, DiffController],
  providers: [
    DocumentAccessService,
    FoldersService,
    DocumentsService,
    DiffService,
    DocumentValidator, // F4 (Phase 6) SOLID — SRP cho validation logic
    DocumentVersionFactory, // F4 (Phase 6) SOLID — SRP cho storage + version creation
  ],
  exports: [DocumentAccessService],
})
export class DocumentsModule {}
