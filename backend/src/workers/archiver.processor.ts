import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';

import { RELEASE_EXPORT_QUEUE } from '../infra/queue/queue.module';
import { MinioS3Service } from '../infra/storage/minio-s3.service';
import { RedisService } from '../infra/cache/redis.service';
import { PrismaService } from '../infra/database/prisma.service';

export interface ReleaseExportJob {
  releaseId: string;
  projectId: string;
}

/**
 * BullMQ archiver (worker-container) — kéo các file thuộc Snapshot của Release từ MinIO,
 * nén .zip dạng stream rồi upload ngược lên MinIO; lưu key vào Redis để API trả presigned URL.
 * Cô lập tải nặng (nhiều file lớn) khỏi API chính (Luồng 20).
 */
@Processor(RELEASE_EXPORT_QUEUE)
export class ArchiverProcessor extends WorkerHost {
  private readonly logger = new Logger(ArchiverProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioS3Service,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<ReleaseExportJob>): Promise<void> {
    const { releaseId, projectId } = job.data;
    this.logger.log(`Bắt đầu nén gói Release ${releaseId}`);

    const items = await this.prisma.releaseDocumentVersion.findMany({
      where: { releaseId },
      include: {
        documentVersion: {
          include: { document: { select: { title: true } } },
        },
      },
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on('data', (c: Buffer) => chunks.push(c));
    archive.pipe(pass);

    for (const it of items) {
      const v = it.documentVersion;
      try {
        const buf = await this.storage.getObjectBuffer(v.storageKey);
        const safeTitle = v.document.title.replace(/[^\w.\-]+/g, '_');
        archive.append(buf, { name: `${safeTitle}_v${v.versionNo}.${v.fileType}` });
      } catch (err) {
        this.logger.warn(`Bỏ qua file lỗi ${v.storageKey}: ${(err as Error).message}`);
      }
    }

    const finished = new Promise<void>((resolve, reject) => {
      pass.on('end', resolve);
      archive.on('error', reject);
    });
    await archive.finalize();
    await finished;

    const zipBuffer = Buffer.concat(chunks);
    const zipKey = `releases/${projectId}/${releaseId}.zip`;
    await this.storage.putObject(zipKey, zipBuffer, 'application/zip');

    // Đánh dấu hoàn tất để API trả presigned URL (TTL 1 giờ)
    await this.redis.client.set(`release:export:${releaseId}`, zipKey, 'EX', 3600);
    this.logger.log(`Hoàn tất nén Release ${releaseId} (${items.length} file, ${zipBuffer.length} bytes).`);
  }
}
