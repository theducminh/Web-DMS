import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

/**
 * WorkflowModule [Luồng 17] — Approval Workflow / FSM vòng đời tài liệu.
 * Import DocumentsModule để dùng DocumentAccessService (phân quyền cấp dự án).
 */
@Module({
  imports: [DocumentsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class WorkflowModule {}
