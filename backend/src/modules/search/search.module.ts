import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * SearchModule [F2 Phase 6] — Global Search dựa trên pg_trgm GIN indexes.
 * PrismaService + CasbinEnforcerService có sẵn qua @Global() InfraModule.
 */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
