import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Yêu cầu JWT (JwtAuthGuard toàn cục). Trả số liệu tổng quan của riêng user.
  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user.sub);
  }

  // D1 (Phase 5): tài liệu mà user đang giữ Redis lock (để trả khóa nhanh từ Dashboard).
  @Get('my-locks')
  getMyLocks(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getMyLocks(user.sub);
  }
}
