import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';
import { CasbinEnforcerService } from '../../infra/abac/casbin-enforcer.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreatePolicyDto, SimulatePolicyDto } from './dto/policies.dto';

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly casbin: CasbinEnforcerService,
    private readonly audit: AuditService,
  ) {}

  // --- Luồng 21: liệt kê toàn bộ luật ABAC đang lưu trong casbin_rule ---
  async listPolicies() {
    const rows = await this.prisma.casbinRule.findMany({ orderBy: { id: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      ptype: r.ptype,
      v0: r.v0,
      v1: r.v1,
      v2: r.v2,
      v3: r.v3,
      v4: r.v4,
      v5: r.v5,
      // Đánh dấu các luật lõi không cho phép xóa qua UI (an toàn vận hành)
      locked: r.ptype === 'p' && r.v0 === 'role_admin',
    }));
  }

  // --- Luồng 22: tạo policy ---
  async createPolicy(dto: CreatePolicyDto, admin: AuthenticatedUser, ip: string) {
    const { ptype } = dto;
    const values = this.mapDtoToValues(dto);

    if (ptype === 'p') {
      // p, v0=sub_rule, v1=obj_rule, v2=action, v3=context(opt), v4=eft(opt)
      if (!values[0] || !values[1] || !values[2]) {
        throw new BadRequestException('Policy ptype=p cần subject (v0), object (v1), action (v2).');
      }
      const added = await this.casbin.addPolicy(...this.trimTrailing(values));
      if (!added) throw new BadRequestException('Luật đã tồn tại (trùng nguyên văn).');
    } else {
      // g, v0=user/role, v1=role
      if (!values[0] || !values[1]) {
        throw new BadRequestException('Grouping ptype=g cần subject (v0) và role (v1).');
      }
      const added = await this.casbin.addGroupingPolicy(values[0], values[1]);
      if (!added) throw new BadRequestException('Grouping đã tồn tại.');
    }

    await this.afterMutation();
    // Lấy lại id mới sinh (Casbin adapter ghi xong) — chỉ match v0/v1/v2 cho ổn định
    // (v3/v4 có thể được adapter lưu là '' thay vì NULL).
    const row = await this.prisma.casbinRule.findFirst({
      where: { ptype, v0: values[0], v1: values[1], v2: values[2] ?? null },
      orderBy: { id: 'desc' },
    });
    await this.audit.log({
      action: 'POLICY_CREATE',
      userId: admin.sub,
      targetId: row?.id?.toString() ?? null,
      ipAddress: ip,
      isSuccess: true,
      metadata: { ptype, values },
    });
    return { ruleId: row?.id, message: 'Khởi tạo luật ABAC và cập nhật bộ máy Casbin thành công.' };
  }

  async deletePolicy(id: number, admin: AuthenticatedUser, ip: string) {
    const row = await this.prisma.casbinRule.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy luật.');
    if (row.ptype === 'p' && row.v0 === 'role_admin') {
      throw new BadRequestException('Luật lõi role_admin không thể xóa qua API.');
    }

    // Giữ giá trị y nguyên (kể cả chuỗi rỗng) để khớp đúng row khi Casbin so sánh
    const all = [row.v0, row.v1, row.v2, row.v3, row.v4, row.v5].map((v) => v ?? '');
    // Cắt phần đuôi rỗng để tránh truyền nhiều tham số hơn rule gốc
    while (all.length > 0 && all[all.length - 1] === '') all.pop();
    const values = all;

    let ok = true;
    if (row.ptype === 'p') {
      ok = await this.casbin.removePolicy(...values);
    } else if (row.ptype === 'g') {
      ok = await this.casbin.removeGroupingPolicy(...values);
    } else {
      // Các ptype khác: xóa trực tiếp DB và reload
      await this.prisma.casbinRule.delete({ where: { id } });
    }
    // Fallback: nếu Casbin không match (do v3='' khác null) -> xóa thẳng theo id
    if (!ok) await this.prisma.casbinRule.delete({ where: { id } });

    await this.afterMutation();
    await this.audit.log({
      action: 'POLICY_DELETE',
      userId: admin.sub,
      targetId: id.toString(),
      ipAddress: ip,
      isSuccess: true,
      metadata: { ptype: row.ptype, values },
    });
    return { message: 'Đã xóa luật và đồng bộ bộ máy Casbin.' };
  }

  // --- Luồng 21: Simulator dry-run ---
  async simulate(dto: SimulatePolicyDto, admin: AuthenticatedUser, ip: string) {
    // Production enforcer của Casbin là READ-ONLY khi gọi enforceEx; không gây ảnh hưởng
    // tới ma trận luật trong RAM (vẫn coi là Sandboxed Dry-Run theo nghĩa không mutate).
    const enforcer = this.casbin.getEnforcer();
    const [allowed, explain] = await (enforcer as any).enforceEx(dto.sub, dto.obj, dto.act);

    let matchedRule: { p: string[] } | null = null;
    let matchedRuleId: number | null = null;
    if (Array.isArray(explain) && explain.length > 0) {
      matchedRule = { p: explain as string[] };
      // Tìm id row trùng nội dung (best-effort)
      const r = await this.prisma.casbinRule.findFirst({
        where: { ptype: 'p', v0: explain[0] ?? null, v1: explain[1] ?? null, v2: explain[2] ?? null },
      });
      matchedRuleId = r?.id ?? null;
    }

    await this.audit.log({
      action: 'POLICY_SIMULATE',
      userId: admin.sub,
      ipAddress: ip,
      isSuccess: true,
      metadata: { sub: dto.sub, obj: dto.obj, act: dto.act, allowed, matchedRuleId },
    });

    return {
      isAllowed: allowed,
      matchedRuleId,
      matchedRule,
      reason: allowed
        ? 'Khớp luật ALLOW.'
        : 'Không có luật ALLOW nào khớp — Default Deny (FR-4.1.3).',
    };
  }

  // --- helpers ---
  private mapDtoToValues(dto: CreatePolicyDto): (string | undefined)[] {
    // Ưu tiên form Builder (subjectCondition...) nếu được cung cấp
    if (dto.subjectCondition || dto.objectCondition || dto.action) {
      return [
        dto.subjectCondition,
        dto.objectCondition,
        dto.action,
        dto.contextCondition,
        dto.effect ?? 'allow',
      ];
    }
    return [dto.v0, dto.v1, dto.v2, dto.v3, dto.v4, dto.v5];
  }

  private trimTrailing(values: (string | undefined)[]): string[] {
    const arr = values.map((v) => v ?? '');
    while (arr.length > 0 && arr[arr.length - 1] === '') arr.pop();
    return arr;
  }

  /** Sau khi sửa policy: reload + purge ABAC cache (FR-4.2.2). */
  private async afterMutation(): Promise<void> {
    await this.casbin.reloadPolicy();
    const keys = await this.redis.client.keys('abac:cache:*');
    if (keys.length) await this.redis.client.del(...keys);
  }
}
