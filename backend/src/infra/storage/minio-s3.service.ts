import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Adapter MinIO (S3 API). Mọi object ghi lên đều bật Server-Side Encryption SSE-S3
 * (AES-256, NFR-1.2).
 *
 * Hai S3 client:
 *  - internal: endpoint `minio:9000` (DNS Docker network) — dùng cho server-to-server:
 *      worker bóc tách text, archiver kéo file, diff-engine tải raw_text qua presigned.
 *  - publicS3: endpoint `MINIO_PUBLIC_ENDPOINT` (vd http://localhost:9000) — dùng để
 *      sinh presigned URL cho TRÌNH DUYỆT (Diff Original view, Download).
 *
 * SigV4 ký HOST header nên cần đúng cặp endpoint <-> URL gửi đi. Bạn vẫn cùng credentials,
 * cùng bucket; MinIO chấp nhận signature khi browser hit đúng host được ký.
 */
@Injectable()
export class MinioS3Service implements OnModuleInit {
  private readonly logger = new Logger(MinioS3Service.name);
  private internal!: S3Client;
  private publicS3!: S3Client;
  private readonly bucket = process.env.MINIO_BUCKET ?? 'vdt-docs';

  onModuleInit(): void {
    const useSsl = process.env.MINIO_USE_SSL === 'true';
    const internalEndpoint = `${useSsl ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT ?? 'minio'}:${process.env.MINIO_PORT ?? '9000'}`;
    const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT ?? internalEndpoint;
    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? '',
    };
    const common = {
      region: process.env.S3_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials,
    };
    this.internal = new S3Client({ ...common, endpoint: internalEndpoint });
    this.publicS3 = new S3Client({ ...common, endpoint: publicEndpoint });
    this.logger.log(`MinIO S3 internal=${internalEndpoint} | public=${publicEndpoint} | bucket=${this.bucket}`);
  }

  /** Upload buffer kèm mã hóa SSE-S3 (AES-256). Service-side. */
  async putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
    await this.internal.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  /** Tải object về buffer (worker bóc tách text, archiver). Service-side. */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const res = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  /** Pre-signed URL cho TRÌNH DUYỆT — mặc định attachment (tải về). */
  async getPresignedDownloadUrl(key: string, expiresIn = 300, filename?: string): Promise<string> {
    return getSignedUrl(
      this.publicS3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: filename
          ? `attachment; filename="${filename.replace(/"/g, '')}"`
          : 'attachment',
      }),
      { expiresIn },
    );
  }

  /**
   * C1 (Phase 5): Pre-signed URL cho PREVIEW INLINE trong browser.
   *   - Force `Content-Disposition: inline` để Chrome KHÔNG auto-tải về (vẫn render).
   *   - Override Content-Type cho .md/.txt sang `text/plain; charset=utf-8` (trước đó
   *     MinIO trả `text/markdown` → Chrome treat unknown → trigger download).
   *   - PDF/image giữ Content-Type gốc (đã renderable inline).
   */
  async getPresignedPreviewUrl(
    key: string,
    fileType: string,
    expiresIn = 300,
  ): Promise<string> {
    const ft = (fileType ?? '').toLowerCase();
    const overrideContentType =
      ft === 'md' || ft === 'txt'
        ? 'text/plain; charset=utf-8'
        : ft === 'pdf'
          ? 'application/pdf'
          : undefined;

    return getSignedUrl(
      this.publicS3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: 'inline',
        ...(overrideContentType ? { ResponseContentType: overrideContentType } : {}),
      }),
      { expiresIn },
    );
  }

  /** Pre-signed URL nội bộ (host=minio:9000) cho service khác (diff-engine, worker). */
  async getInternalPresignedUrl(key: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(this.internal, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }
}
