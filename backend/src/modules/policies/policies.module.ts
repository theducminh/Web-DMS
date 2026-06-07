import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { AdminGuard } from '../../core/guards/admin.guard';

/**
 * PoliciesModule [Luồng 21, 22] — Manager + Visual Rule Builder + Simulator.
 * CasbinEnforcerService toàn cục (InfraModule) — không cần import lại.
 */
@Module({
  controllers: [PoliciesController],
  providers: [PoliciesService, AdminGuard],
})
export class PoliciesModule {}
