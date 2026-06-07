import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Adapter Redis — quản lý Session, Force Logout (Blacklist), Rate-limit,
 * cache quyền ABAC (TTL 5 phút), cờ system:lockdown, khóa tài liệu (SETEX doc:lock:*).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client!: Redis;

  onModuleInit(): void {
    this.client = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: null },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
