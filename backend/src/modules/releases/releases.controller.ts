import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto } from './dto/releases.dto';

/** Luồng 19, 20 — Release Packages & Compliance Checklist. */
@ApiTags('releases')
@ApiBearerAuth()
@Controller('projects/:projectId/releases')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string) {
    return this.releases.list(projectId, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateReleaseDto,
  ) {
    return this.releases.create(projectId, dto, user);
  }

  @Get(':releaseId/compliance')
  compliance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releases.getCompliance(projectId, releaseId, user);
  }

  @Post(':releaseId/export')
  @HttpCode(HttpStatus.ACCEPTED)
  requestExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releases.requestExport(projectId, releaseId, user);
  }

  @Get(':releaseId/export')
  getExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releases.getExport(projectId, releaseId, user);
  }
}
