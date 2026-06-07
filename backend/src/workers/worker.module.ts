import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InfraModule } from '../infra/infra.module';
import { QueueModule } from '../infra/queue/queue.module';
import { ExtractorProcessor } from './extractor.processor';
import { MailerProcessor } from './mailer.processor';
import { ArchiverProcessor } from './archiver.processor';
import { IntegrityCheckerProcessor } from './integrity-checker.processor';
import { MailService } from '../modules/auth/mail.service';

/**
 * WorkerModule — root module cho worker-container. Đăng ký các BullMQ processor
 * (chỉ worker tiêu thụ job; API không đăng ký processor để tránh xử lý trùng).
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), InfraModule, QueueModule],
  providers: [ExtractorProcessor, MailerProcessor, ArchiverProcessor, IntegrityCheckerProcessor, MailService],
})
export class WorkerModule {}
