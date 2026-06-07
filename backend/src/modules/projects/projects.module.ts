import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { MembersController } from './members.controller';
import { ProjectTemplatesController } from './templates.controller';
import { ProjectsService } from './projects.service';
import { MembersService } from './members.service';

/**
 * ProjectsModule [Luồng 10, 11, 13, 14] — Portfolio, khởi tạo dự án (sinh folder
 * theo template + đồng bộ Casbin), quản lý thành viên, cấu hình/đóng băng dự án.
 */
@Module({
  controllers: [ProjectsController, MembersController, ProjectTemplatesController],
  providers: [ProjectsService, MembersService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
