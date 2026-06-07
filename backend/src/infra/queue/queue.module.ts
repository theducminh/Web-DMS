import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const TEXT_EXTRACTION_QUEUE = 'text-extraction';
export const MAILER_QUEUE = 'mailer';
export const RELEASE_EXPORT_QUEUE = 'release-export';
export const INTEGRITY_SCAN_QUEUE = 'integrity-scan';

/**
 * QueueModule (Global) — kết nối BullMQ tới Redis và đăng ký các queue.
 * API dùng để enqueue job; worker-container dùng để đăng ký processor tiêu thụ.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'redis',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({ name: TEXT_EXTRACTION_QUEUE }),
    BullModule.registerQueue({ name: MAILER_QUEUE }),
    BullModule.registerQueue({ name: RELEASE_EXPORT_QUEUE }),
    BullModule.registerQueue({ name: INTEGRITY_SCAN_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
