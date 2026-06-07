import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { newEnforcer, newModelFromString, Enforcer } from 'casbin';
import { PrismaAdapter } from 'casbin-prisma-adapter';

/**
 * Casbin ABAC/RBAC Engine (Node-Casbin + Prisma Adapter -> bảng casbin_rule).
 *
 * Model: RBAC theo resource + so khớp đường dẫn (custom keyMatchPath hỗ trợ cả
 * ':param' và '*') + Default Deny (FR-4.1.3). Các luật điều kiện ABAC nâng cao
 * (giờ hành chính, clearance) do module Policies (Luồng 21/22) bơm thêm.
 */
const MODEL_TEXT = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act, eft

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.sub, p.sub) && keyMatchPath(r.obj, p.obj) && (r.act == p.act || p.act == "*")
`;

/**
 * So khớp đường dẫn: pattern hỗ trợ ':param' (1 đoạn) và '*' (mọi ký tự còn lại).
 *   keyMatchPath('/api/v1/projects/p1/folders', '/api/v1/projects/:id/*') === true
 */
function keyMatchPath(key1: string, key2: string): boolean {
  const escaped = key2.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = '^' + escaped.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*') + '$';
  return new RegExp(pattern).test(key1);
}

@Injectable()
export class CasbinEnforcerService implements OnModuleInit {
  private readonly logger = new Logger(CasbinEnforcerService.name);
  private enforcer!: Enforcer;

  async onModuleInit(): Promise<void> {
    const adapter = await PrismaAdapter.newAdapter();
    const model = newModelFromString(MODEL_TEXT);
    this.enforcer = await newEnforcer(model, adapter);
    this.enforcer.addFunction('keyMatchPath', keyMatchPath as any);
    await this.enforcer.loadPolicy();
    this.logger.log('Casbin Enforcer đã khởi tạo và nạp policy từ casbin_rule.');
  }

  getEnforcer(): Enforcer {
    return this.enforcer;
  }

  /** Kiểm tra quyền: subject (userId), object (path/resource), action (method/hành động). */
  enforce(sub: string, obj: string, act: string): Promise<boolean> {
    return this.enforcer.enforce(sub, obj, act);
  }

  // --- Quản trị policy (dùng bởi module Projects/Admin/Policies) ---
  addPolicy(...params: string[]): Promise<boolean> {
    return this.enforcer.addPolicy(...params);
  }

  removePolicy(...params: string[]): Promise<boolean> {
    return this.enforcer.removePolicy(...params);
  }

  addGroupingPolicy(...params: string[]): Promise<boolean> {
    return this.enforcer.addGroupingPolicy(...params);
  }

  removeGroupingPolicy(...params: string[]): Promise<boolean> {
    return this.enforcer.removeGroupingPolicy(...params);
  }

  getRolesForUser(userId: string): Promise<string[]> {
    return this.enforcer.getRolesForUser(userId);
  }

  /** Nạp lại toàn bộ ma trận luật từ DB vào RAM (sau khi Admin sửa policy). */
  reloadPolicy(): Promise<void> {
    return this.enforcer.loadPolicy();
  }
}
