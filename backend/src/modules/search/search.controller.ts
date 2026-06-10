import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { SearchService } from './search.service';

/**
 * F2 (Phase 6) — Global Search endpoint cho ô tìm kiếm topbar Ctrl+K.
 *  GET /api/v1/search?q=<query>&limit=8
 */
@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  global(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.max(1, Math.min(20, Number(limit ?? 8)));
    return this.search.globalSearch(q ?? '', user, parsedLimit);
  }
}
