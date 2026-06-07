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
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  CreateTemplateFolderDto,
  UpdateTemplateDto,
  UpdateTemplateFolderDto,
  UpdateTemplateStatusDto,
} from './dto/templates.dto';

/** Luồng 26 — Template Master Data (Admin). */
@ApiTags('admin-templates')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/project-templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateTemplateDto, @Req() req: Request) {
    return this.templates.create(dto, admin, this.ip(req));
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  setStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateStatusDto,
    @Req() req: Request,
  ) {
    return this.templates.setStatus(id, dto, admin, this.ip(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: Request,
  ) {
    return this.templates.update(id, dto, admin, this.ip(req));
  }

  @Post(':id/folders')
  @HttpCode(HttpStatus.CREATED)
  addFolder(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateTemplateFolderDto,
    @Req() req: Request,
  ) {
    return this.templates.addFolder(id, dto, admin, this.ip(req));
  }

  @Patch(':id/folders/:folderId')
  @HttpCode(HttpStatus.OK)
  updateFolder(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateTemplateFolderDto,
    @Req() req: Request,
  ) {
    return this.templates.updateFolder(id, folderId, dto, admin, this.ip(req));
  }

  @Delete(':id/folders/:folderId')
  @HttpCode(HttpStatus.OK)
  removeFolder(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Param('folderId') folderId: string,
    @Req() req: Request,
  ) {
    return this.templates.removeFolder(id, folderId, admin, this.ip(req));
  }

  private ip(req: Request): string {
    return (req.ip ?? '').replace('::ffff:', '');
  }
}
