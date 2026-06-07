import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as mammoth from 'mammoth';

import { TEXT_EXTRACTION_QUEUE } from '../infra/queue/queue.module';
import { MinioS3Service } from '../infra/storage/minio-s3.service';
import { PrismaService } from '../infra/database/prisma.service';

// pdf-parse: nạp qua đường dẫn lib để tránh side-effect đọc file test ở index.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export interface ExtractionJob {
  documentVersionId: string;
  storageKey: string;
  fileType: string;
}

/**
 * BullMQ processor (chạy trong worker-container) — bóc tách Raw Text từ PDF/Docx/MD/TXT,
 * lưu ngược lại MinIO làm raw_text_storage_key phục vụ Diff Engine (NFR-2.2).
 * Cô lập rủi ro OOM khỏi API chính.
 */
@Processor(TEXT_EXTRACTION_QUEUE)
export class ExtractorProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractorProcessor.name);

  constructor(
    private readonly storage: MinioS3Service,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ExtractionJob>): Promise<void> {
    const { documentVersionId, storageKey, fileType } = job.data;
    this.logger.log(`Bóc tách text: version=${documentVersionId} file=${storageKey} type=${fileType}`);

    const buffer = await this.storage.getObjectBuffer(storageKey);
    const text = await this.extractText(buffer, fileType);

    const rawKey = `${storageKey}.txt`;
    await this.storage.putObject(rawKey, Buffer.from(text, 'utf-8'), 'text/plain; charset=utf-8');

    await this.prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: { rawTextStorageKey: rawKey, textExtracted: true },
    });
    this.logger.log(`Hoàn tất bóc tách version=${documentVersionId} (${text.length} ký tự).`);
  }

  private async extractText(buffer: Buffer, fileType: string): Promise<string> {
    switch (fileType.toLowerCase()) {
      case 'pdf': {
        const data = await pdfParse(buffer);
        return data.text ?? '';
      }
      case 'docx': {
        const res = await mammoth.extractRawText({ buffer });
        return res.value ?? '';
      }
      case 'md':
      case 'txt':
      default:
        return buffer.toString('utf-8');
    }
  }
}
