import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';

/**
 * Dashboard summary (Luồng 4). Data Isolation: chỉ tính trên các dự án mà user
 * là thành viên hoặc owner (chống rò rỉ dữ liệu — Strict SQL Security Join).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // D1 (Phase 5): liệt kê tài liệu bản thân user đang giữ Redis lock + remaining TTL.
  // Cho phép user "trả khóa" trực tiếp từ Dashboard mà không cần navigate vào doc detail.
  async getMyLocks(userId: string) {
    // Lock keys: doc:lock:<docId> với value = userId; TTL DOC_LOCK_TTL_SECONDS (mặc định 2h)
    const allKeys = await this.redis.client.keys('doc:lock:*');
    if (allKeys.length === 0) return { locks: [] };

    // Lấy giá trị từng key (Redis pipeline để tối ưu)
    const pipe = this.redis.client.pipeline();
    for (const k of allKeys) {
      pipe.get(k);
      pipe.ttl(k);
    }
    const results = (await pipe.exec()) ?? [];

    const myLocked: Array<{ docId: string; ttl: number }> = [];
    for (let i = 0; i < allKeys.length; i++) {
      const owner = results[i * 2]?.[1] as string | null;
      const ttl = (results[i * 2 + 1]?.[1] as number) ?? -1;
      if (owner === userId) {
        const docId = allKeys[i].replace('doc:lock:', '');
        myLocked.push({ docId, ttl });
      }
    }

    if (myLocked.length === 0) return { locks: [] };

    // Join Prisma để lấy title + projectId + projectName
    const docs = await this.prisma.document.findMany({
      where: { id: { in: myLocked.map((m) => m.docId) }, isDeleted: false },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { name: true } },
      },
    });

    return {
      locks: myLocked
        .map((m) => {
          const doc = docs.find((d) => d.id === m.docId);
          return doc
            ? {
                docId: m.docId,
                title: doc.title,
                projectId: doc.projectId,
                projectName: doc.project.name,
                ttlSeconds: m.ttl,
              }
            : null;
        })
        .filter(Boolean),
    };
  }

  async getSummary(userId: string) {
    // ID các dự án user được phép thấy
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true, projectRole: true },
    });
    const owned = await this.prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const projectIds = Array.from(
      new Set([...memberships.map((m) => m.projectId), ...owned.map((o) => o.id)]),
    );

    if (projectIds.length === 0) {
      return { assignedProjectsCount: 0, pendingMyReviewCount: 0, recentDocuments: [] };
    }

    // Số tài liệu đang chờ duyệt trong các dự án user có vai trò PM/REVIEWER
    const reviewerProjectIds = memberships
      .filter((m) => m.projectRole === 'PM' || m.projectRole === 'REVIEWER')
      .map((m) => m.projectId);

    const [pendingMyReviewCount, recentDocuments] = await Promise.all([
      reviewerProjectIds.length
        ? this.prisma.document.count({
            where: { projectId: { in: reviewerProjectIds }, status: 'UNDER_REVIEW', isDeleted: false },
          })
        : Promise.resolve(0),
      this.prisma.document.findMany({
        where: { projectId: { in: projectIds }, isDeleted: false },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, updatedAt: true, status: true },
      }),
    ]);

    return {
      assignedProjectsCount: projectIds.length,
      pendingMyReviewCount,
      recentDocuments,
    };
  }
}
