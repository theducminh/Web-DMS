import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { register } from 'prom-client';
import { Public } from '../../core/decorators/public.decorator';

/**
 * F3 (Phase 6) — Endpoint `/api/v1/metrics` cho Prometheus scrape.
 * Public (không cần JWT) để Prometheus container scrape qua HTTP internal.
 * Trả về định dạng OpenMetrics text plain — tổng hợp:
 *   - Default Node.js metrics (CPU, RAM, GC, event loop, heap)
 *   - HTTP request metrics (nếu cài @willsoto/nestjs-prometheus interceptor)
 *   - Custom business metrics (đăng ký qua @InjectMetric)
 */
@Controller()
export class AppMetricsController {
  @Public()
  @Get('metrics')
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}
