import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request } from 'express';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Ghi Audit Log tự động cho route có @Audit('ACTION'). Thành công -> is_success=true;
 * lỗi -> is_success=false kèm fail_reason. Hash Chaining do trigger DB đảm nhiệm.
 */
@Injectable()
export class AuditHashInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as AuthenticatedUser | undefined;
    const ip = (request.ip ?? '').replace('::ffff:', '');
    const targetId =
      (request.params?.['id'] as string) ??
      (request.params?.['docId'] as string) ??
      (request.params?.['projectId'] as string) ??
      null;

    return next.handle().pipe(
      tap(() => {
        void this.audit.log({
          action,
          userId: user?.sub ?? null,
          targetId,
          ipAddress: ip,
          isSuccess: true,
        });
      }),
      catchError((err) => {
        void this.audit.log({
          action,
          userId: user?.sub ?? null,
          targetId,
          ipAddress: ip,
          isSuccess: false,
          failReason: err?.message ?? 'Unknown error',
        });
        return throwError(() => err);
      }),
    );
  }
}
