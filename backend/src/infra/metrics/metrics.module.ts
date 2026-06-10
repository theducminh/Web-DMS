import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppMetricsController } from './metrics.controller';

/**
 * MetricsModule (F3 Phase 6) — Bật default Node.js metrics + bind controller riêng
 * (AppMetricsController dùng @Public để Prometheus scrape không cần JWT token).
 *
 * Endpoint cuối cùng (sau global prefix): GET /api/v1/metrics
 *
 * defaultMetrics: { enabled: true } -> prom-client tự collect:
 *   - process_cpu_seconds_total, process_resident_memory_bytes
 *   - nodejs_eventloop_lag_seconds, nodejs_heap_size_total_bytes
 *   - nodejs_active_handles_total, nodejs_active_requests_total
 */
@Module({
  imports: [
    PrometheusModule.register({
      controller: AppMetricsController,
      defaultMetrics: { enabled: true },
      defaultLabels: { app: 'vdt-dms-backend' },
    }),
  ],
})
export class MetricsModule {}
