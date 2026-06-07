import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { MAILER_QUEUE } from '../infra/queue/queue.module';
import { MailService } from '../modules/auth/mail.service';

export interface ReviewResultJob {
  to: string;
  documentTitle: string;
  decision: string;
  reason?: string;
  reviewerName?: string;
}

/**
 * BullMQ processor gửi email bất đồng bộ (worker-container). Hiện xử lý job
 * 'sendReviewResult' (Luồng 17) — gửi kết quả phê duyệt cho tác giả tài liệu.
 */
@Processor(MAILER_QUEUE)
export class MailerProcessor extends WorkerHost {
  private readonly logger = new Logger(MailerProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<ReviewResultJob>): Promise<void> {
    if (job.name === 'sendReviewResult') {
      const { to, ...payload } = job.data;
      await this.mail.sendReviewResult(to, payload);
      this.logger.log(`Đã gửi email kết quả duyệt tới ${to} (${payload.decision}).`);
    }
  }
}
