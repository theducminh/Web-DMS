import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Giới hạn thời gian xử lý request để tránh treo tài nguyên.
 * Mặc định 30s (cấu hình qua REQUEST_TIMEOUT_MS).
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly ms = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.ms),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Yêu cầu xử lý quá lâu.'));
        }
        return throwError(() => err);
      }),
    );
  }
}
