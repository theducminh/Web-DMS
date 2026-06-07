import { Global, Module } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { RedisService } from './cache/redis.service';
import { CasbinEnforcerService } from './abac/casbin-enforcer.service';
import { MinioS3Service } from './storage/minio-s3.service';

/**
 * InfraModule — các Adapter hạ tầng dùng chung (Global):
 * Prisma (DB), Redis (session/cache/lock), Casbin (ABAC), MinIO (object storage).
 */
@Global()
@Module({
  providers: [PrismaService, RedisService, CasbinEnforcerService, MinioS3Service],
  exports: [PrismaService, RedisService, CasbinEnforcerService, MinioS3Service],
})
export class InfraModule {}
