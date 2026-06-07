import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AuditService } from './audit/audit.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CasbinAbacGuard } from './guards/casbin-abac.guard';
import { Lockdown503Guard } from './guards/lockdown-503.guard';
import { AuditHashInterceptor } from './interceptors/audit-hash.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

/**
 * CoreModule — Bảo mật lõi, áp dụng TOÀN CỤC theo thứ tự:
 *   Guards:       Lockdown503 -> JwtAuth -> CasbinAbac
 *   Interceptors: Timeout -> AuditHash
 *   Filter:       GlobalException
 * (InfraModule cung cấp Prisma/Redis/Casbin ở phạm vi Global nên không cần import lại.)
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    }),
  ],
  providers: [
    AuditService,
    { provide: APP_GUARD, useClass: Lockdown503Guard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CasbinAbacGuard },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditHashInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [AuditService, JwtModule],
})
export class CoreModule {}
