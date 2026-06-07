import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

/** Extract IP an toàn, strip IPv4-mapped IPv6 prefix. */
const ip = (req: Request): string => (req.ip ?? '').replace('::ffff:', '');

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  QueryProjectsDto,
  ToggleStarDto,
  UpdateProjectDto,
} from './dto/projects.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // --- Luồng 10 ---
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryProjectsDto) {
    return this.projects.listProjects(user, query);
  }

  // --- Luồng 11 ---
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projects.createProject(user, dto);
  }

  @Get(':projectId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string) {
    return this.projects.getProject(projectId, user);
  }

  // --- Luồng 14 ---
  @Patch(':projectId')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ) {
    return this.projects.updateProject(projectId, user, dto, ip(req));
  }

  @Post(':projectId/restore')
  @HttpCode(HttpStatus.OK)
  restore(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string, @Req() req: Request) {
    return this.projects.restoreProject(projectId, user, ip(req));
  }

  @Post(':projectId/star')
  @HttpCode(HttpStatus.OK)
  star(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: ToggleStarDto,
  ) {
    return this.projects.toggleStar(projectId, userId, dto.isStarred);
  }
}
