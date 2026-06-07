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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { MembersService } from './members.service';
import { AddMemberDto, UpdateMemberDto } from './dto/projects.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects/:projectId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string) {
    return this.members.list(projectId, user);
  }

  // B1 (Phase 5): Search candidates trong toàn DB — PM hoặc Admin gọi được.
  @Get('searchable')
  searchable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.members.searchable(projectId, q ?? '', user, Number(limit ?? 15));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.members.add(projectId, dto, user);
  }

  @Patch(':userId')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(projectId, userId, dto, user);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.members.remove(projectId, userId, user);
  }
}
