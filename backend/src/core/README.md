# core/ — Bảo mật lõi (Phase 3)

Chứa các thành phần bảo mật chạy xuyên suốt mọi request:

- `guards/`
  - `jwt-auth.guard.ts` — Xác thực JWT từ HttpOnly Cookie.
  - `casbin-abac.guard.ts` — Phân quyền ABAC tự động qua Node-Casbin.
  - `lockdown-503.guard.ts` — [Luồng 25] Chặn toàn bộ khi Panic Mode (cờ Redis `system:lockdown`).
- `interceptors/`
  - `audit-hash.interceptor.ts` — Băm xích log (Hash Chaining) cho mọi request đổi dữ liệu.
  - `timeout.interceptor.ts` — Timeout request.
- `filters/`
  - `global-exception.filter.ts` — Tập trung xử lý lỗi (Prisma P2002 → 409, Casbin → 403, ...).
