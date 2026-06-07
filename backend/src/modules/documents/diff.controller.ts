import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DiffService } from './diff.service';

/** Luồng 18 — Hybrid Visual Diff Engine. */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DiffController {
  constructor(private readonly diff: DiffService) {}

  @Get(':docId/diff')
  getDiff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId') docId: string,
    @Query('v1', ParseIntPipe) v1: number,
    @Query('v2', ParseIntPipe) v2: number,
  ) {
    return this.diff.getDiff(docId, v1, v2, user);
  }
}
