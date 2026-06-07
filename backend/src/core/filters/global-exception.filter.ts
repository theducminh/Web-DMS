import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Bộ lọc lỗi tập trung: ánh xạ lỗi Prisma và chuẩn hóa response.
 *   - P2002 (unique) -> 409 Conflict
 *   - P2025 (not found) -> 404 Not Found
 *   - P2003 (FK) -> 400 Bad Request
 *   - HttpException -> giữ nguyên status/message
 *   - Khác -> 500 (ẩn chi tiết nội bộ)
 * Lỗi 403 (ABAC) giữ thông báo chung chung, không lộ lý do (FR-4.2.1).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Đã xảy ra lỗi hệ thống.';
    let error = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r['message'] as string | string[]) ?? exception.message;
        error = (r['error'] as string) ?? error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Dữ liệu đã tồn tại (vi phạm ràng buộc duy nhất).';
          error = 'CONFLICT';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Không tìm thấy tài nguyên.';
          error = 'NOT_FOUND';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Vi phạm ràng buộc khóa ngoại.';
          error = 'FOREIGN_KEY_CONSTRAINT';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = 'Yêu cầu không hợp lệ.';
          error = `PRISMA_${exception.code}`;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${request.url}`, exception as Error);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
