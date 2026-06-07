import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './users.controller';
import { DepartmentsController } from './departments.controller';
import { AdminUsersService } from './users.service';
import { DepartmentsService } from './departments.service';
import { AdminGuard } from '../../core/guards/admin.guard';

/**
 * AdminModule [Luồng 7, 8, 9] — User Directory + bulk ops, gán thuộc tính ABAC,
 * quản lý Departments. Toàn bộ endpoint bọc AdminGuard (Casbin role_admin).
 * Import AuthModule để dùng AuthService.revokeAllSessions (Mass Session Eviction).
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, DepartmentsController],
  providers: [AdminUsersService, DepartmentsService, AdminGuard],
})
export class AdminModule {}
