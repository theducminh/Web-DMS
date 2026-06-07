import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

/**
 * Entry point tiến trình Worker (container riêng — APP_ROLE=worker).
 * Tiêu thụ BullMQ queue nặng (bóc tách text PDF/Docx, ...) để không nghẽn API chính.
 */
async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });
  app.enableShutdownHooks();
  new Logger('Worker').log('[VDT-DMS] Worker đã khởi động, sẵn sàng tiêu thụ BullMQ jobs.');
}

bootstrapWorker().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[VDT-DMS] Worker khởi động thất bại:', err);
  process.exit(1);
});
