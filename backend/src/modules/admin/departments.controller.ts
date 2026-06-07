import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AdminGuard } from '../../core/guards/admin.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  UpdateDepartmentStatusDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list() {
    return this.departments.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    return this.departments.create(dto, admin.sub, this.ip(req));
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentStatusDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.departments.setStatus(id, dto, admin.sub, this.ip(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.departments.update(id, dto, admin.sub, this.ip(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    return this.departments.remove(id, admin.sub, this.ip(req));
  }

  private ip(req: Request): string {
    return (req.ip ?? '').replace('::ffff:', '');
  }
}
