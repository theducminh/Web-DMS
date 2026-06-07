# VDT Zero-Trust DMS — Progress Tracker

> Snapshot trạng thái dự án — cập nhật theo từng sprint. Mỗi luồng nghiệp vụ được
> chấm "code & verified thật" khi đã chạy E2E qua Docker với kết quả kiểm chứng.
>
> 📖 **Người mới vào dự án** → đọc [`GUIDE.md`](./GUIDE.md) trước (sơ đồ kiến trúc + web GUI quản lý từng tài nguyên + monitor realtime).

---

## 0. Resume Checklist (BẮT BUỘC chạy đầu mỗi session mới)

> Mỗi khi mở phiên mới, làm tuần tự **6 bước** dưới đây trước khi gen bất kỳ code nào.
> Mục tiêu: không lạc setup cũ, không phá pinned decisions, không gen lại file đã có.

### Bước 1 — Đọc PROGRESS.md theo thứ tự ưu tiên
1. **§9 Pinned Architecture Decisions** ← đọc TRƯỚC mọi thứ. Không được vi phạm.
2. **§1** xem luồng nào ✅ rồi (không gen lại).
3. **§5 Việc dang dở** + **§8 Việc tiếp theo** ← hiểu hướng nào đang chờ user chọn.
4. **§6 Bug đã fix** ← tránh giẫm lại 17 lỗi cũ.
5. **§2 Hạ tầng & cấu hình** ← nhớ đúng tên container, port, env var.

### Bước 2 — Đọc mục lục thiết kế (luồng nào cần thì mở file đó)
```
D:\WEB SEC\docs\architecture\README.md          # mục lục 26 luồng
D:\WEB SEC\docs\architecture\<luong-XX>.md      # chi tiết Layout/UX/Frontend/Backend/Under the Hood
```
Khi user yêu cầu "làm UI/feature X cho luồng N", **đọc `luong-N*.md` trước khi viết code**.
Code phải bám 100% spec — đây là rule cứng "Tuyệt đối không Hallucinate".

### Bước 3 — Kiểm tra hạ tầng Docker đang chạy
```bash
docker ps --filter name=vdt --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
Phải thấy đủ **7 container**:
`vdt-postgres` (healthy) · `vdt-redis` (healthy) · `vdt-minio` (healthy) ·
`vdt-diff-engine` (up) · `vdt-api-test` (up) · `vdt-worker-test` (up) · `vdt-frontend-dev` (up).

Nếu thiếu → chạy lại theo §7 (đặc biệt: `docker restart` **KHÔNG** reload `--env-file`, phải `docker rm -f` rồi `docker run` lại).

### Bước 4 — Smoke test API + Frontend còn sống
```bash
# API health (login admin)
curl -s -c /tmp/c.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@viettel.com.vn","password":"Admin@123456"}' | head -c 200

# Frontend
curl -sI http://localhost:5173/ | head -1     # phải 200 OK
```
Nếu login fail → kiểm tra DB còn data không (`docker exec vdt-postgres psql -U vdt_admin -d vdt_dms -c "SELECT count(*) FROM profiles;"`). Nếu seed bay → chạy lại `npx prisma db seed`.

### Bước 5 — Verify chuỗi Hash Chain còn nguyên (không có ai sửa lén audit_logs)
```bash
docker exec vdt-postgres psql -U vdt_admin -d vdt_dms -c "
  SELECT count(*) FROM audit_logs WHERE current_hash IS NULL OR previous_hash IS NULL;"
# Kỳ vọng: 0
```
Hoặc bấm `/admin/security-alerts` → "Quét toàn bộ" để hệ thống tự verify qua BullMQ.

### Bước 6 — Hỏi user hướng đi (a/b/c) TRƯỚC khi code
Phiên trước để dang dở ở §8. **Không tự ý chọn** — phải confirm với user:
- (a) Nginx production + `make up` 1 lệnh (NFR-3.2)
- (b) Thêm 15 page frontend còn thiếu (xem §1.2 "Còn lại chưa có UI")
- (c) Hướng khác mà user yêu cầu

Sau khi user chốt → mới bắt đầu Atomic Writes & log từng file tạo/sửa.

---

## 1. Bản đồ luồng nghiệp vụ (25 cốt lõi + 1 bonus)

### 1.1 Backend (NestJS modular monolith) — **25/25 + bonus ✅**

| # | Luồng | Module backend | Trạng thái | Verified E2E |
|---|---|---|---|---|
| 1 | Đăng nhập hợp nhất (`/auth/login`) | `auth/` | ✅ | login → JWT + cookie + audit; brute-force 3 sai → 429 |
| 2 | Đăng ký nhân viên (OTP) | `auth/` | ✅ | request-otp → verify-otp → tạo PENDING → login bị 403 |
| 3 | Khôi phục mật khẩu (OTP) | `auth/` | ✅ | generic message; reset → session eviction; pass cũ 401 |
| 4 | Dashboard (My Workspace) | `dashboard/` | ✅ | `assignedProjectsCount`/`pendingMyReviewCount`/`recentDocuments` |
| 5 | Hồ sơ cá nhân | `profile/` | ✅ | PATCH có cổng PASSWORD/OTP, strip `clearanceLevel` chống nâng quyền |
| 6 | An toàn tài khoản | `profile/` | ✅ | change-password → revoke all sessions; list/revoke sessions |
| 7 | User Directory + bulk ops | `admin/` | ✅ | bulk-status DISABLE → Mass Session Eviction |
| 8 | Gán thuộc tính ABAC | `admin/` | ✅ | Force Eviction + audit before/after; re-login JWT có claim mới |
| 9 | Departments | `admin/` | ✅ | CRUD + P2002 → 409; chặn xóa khi còn nhân sự |
| 10 | Project Portfolio | `projects/` | ✅ | Data Isolation theo membership; role/isStarred resolve đúng |
| 11 | Khởi tạo dự án | `projects/` | ✅ | ACID transaction sinh folder từ template + Casbin grouping + policy PM |
| 12 | Folder Navigator + Lock + Trash | `documents/` | ✅ | breadcrumbs, template lock guard, Redis SETEX lock, soft delete |
| 13 | Project Team | `projects/` | ✅ | add/update/remove + Casbin grouping sync; PM Self-Removal Protection |
| 14 | Project Settings + Archive | `projects/` | ✅ | archive cascade clear locks; restore |
| 15 | Upload tài liệu | `documents/` | ✅ | multer memoryStorage → MinIO SSE-S3 → enqueue BullMQ extraction |
| 16 | Document Detail + Download | `documents/` | ✅ | versions, restore (append-only), presigned download, ABAC clearance, anomaly ZSET |
| 17 | Approval Workflow (FSM) | `workflow/` | ✅ | DRAFT→UNDER_REVIEW→RELEASED/DRAFT; hard lock; BullMQ mailer |
| 18 | Hybrid Visual Diff Engine | `documents/` + `diff-engine/` | ✅ | Python FastAPI difflib; presigned text → diff; deltas + originalUrls |
| 19 | Release Packages | `releases/` | ✅ | Immutable Snapshot version RELEASED; chấm compliance sync |
| 20 | Compliance Checklist + Export | `releases/` | ✅ | mapping template→docs; BullMQ archiver nén .zip → Redis key → presigned |
| 21 | ABAC Policy Manager | `policies/` | ✅ | list + simulator dry-run (`enforceEx` matched rule) |
| 22 | Visual Rule Builder | `policies/` | ✅ | create/delete + reloadPolicy + purge `abac:cache:*` |
| 23 | Audit Ledger Dashboard | `security/` | ✅ | cursor pagination + lọc theo time/IP/action/status |
| 24 | Compliance Export | `security/` | ✅ | CSV streaming (BOM + cursor batch); PDF watermark + SHA-256 footer |
| 25 | Tamper Detection Hub + Lockdown | `security/` | ✅ | BullMQ integrity scan; Emergency Lockdown (PIN+IP safe); Release |
| 26 | Project Templates Master (bonus) | `templates/` | ✅ | CRUD + Path Materialization cascade rename/delete; locked guard |

### 1.2 Frontend (React + Vite + Tailwind + FSD) — **25/25 page lõi ✅**

| Route | Luồng | Trạng thái | Ghi chú |
|---|---|---|---|
| `/auth/login` | 1 | ✅ | split-screen, prefill demo creds, flash registered/reset/password_changed |
| `/auth/register` | 2 | ✅ | Card + Stepper 2 bước (info→OTP), slide animation, strength meter, 6 ô OTP paste/auto-advance, 60s resend |
| `/auth/forgot-password` | 3 | ✅ | Stepper 3 bước Email→OTP→New Password; generic User Enumeration message |
| `/dashboard` | 4 | ✅ | 3 stat card + recent docs |
| `/profile` | 5 | ✅ | Asymmetric 2-column + **Password Gate Modal**: PASSWORD/OTP adaptive, 3 sai → khóa 60s đếm ngược, isDirty gate |
| `/profile/security` | 6 | ✅ | Split-grid: change password (strength meter + chặn trùng cũ) + Active Sessions list với Revoke + **Panic Button** |
| `/projects` | 10 | ✅ | card grid + nút "Tạo dự án mới" + link Đội ngũ/Settings cho mỗi card |
| `/projects/create` | 11 | ✅ | Wizard 2 bước: info+template (radio cards + Preview Tree 🔒/📁) → team (search + role assign); ACID transaction tạo folder + Casbin sync |
| `/projects/:pid/team` | 13 | ✅ | Team Grid + Inline Role Dropdown (spinner per-row khi mutate); AddMemberModal async search (loại trừ đã có); **Self-Removal Protection** cho PM Owner |
| `/projects/:pid/settings` | 14 | ✅ | General (dirty state + beforeunload guard) + **Danger Zone** Archive với modal "gõ tên dự án" để confirm; Unarchive khi ARCHIVED |
| `/projects/:pid/folders/:fid` | 12 | ✅ | breadcrumbs + subfolders 🔒/📁 + docs table + nút Upload/Team/Settings/Releases; click tên doc → Detail |
| `/projects/:pid/documents/upload` | 15 | ✅ | Dropzone 2/3 drag-over animation + Metadata form 1/3; pre-validation type/size; **axios onUploadProgress thật KB/s**; cảnh báo vàng >15MB no-Diff; sau success → redirect detail |
| `/documents/:docId/detail` | 16 | ✅ | **3 Tabs**: Preview (iframe presigned), Metadata (ABAC), Version Timeline. **Pessimistic Lock** với heartbeat 30s; **cross-version Diff** checkbox + floating bar; Restore Append-only; Download xử lý 403/429 |
| `/documents/:docId/review` | 17 | ✅ | Split-screen iframe + Decision Panel; **Reject validation ≥10 ký tự** client+server; **full-page Overlay Loader** chống double-submit; lịch sử versions collapsible |
| `/documents/diff` | 18 | ✅ | toggle **Xem bản gốc** (iframe MinIO) ↔ **Xem thay đổi** (split-view delta) |
| `/admin/users` | 7 | ✅ | data table + filter debounce 300ms + bulk actions floating bar (Mass Eviction confirm + reason) |
| `/admin/users/:userId/attributes` | 8 | ✅ | two-column summary + form + Clearance Escalation Warning + isDirty gate |
| `/admin/departments` | 9 | ✅ | master-detail + Safe Delete Guard (employeeCount > 0 disabled) + 409 unique validation |
| `/admin/project-templates` | 26 | ✅ | master-detail Tree Builder recursive + locked guard + Path Materialization rename + status toggle |
| `/admin/audit-logs` | 23 | ✅ | cursor pagination + filter + row expansion JSON + link Export |
| `/admin/audit-logs/export` | 24 | ✅ | datetime-local + quick presets 24h/7d/30d/90d + scope ALL/SECURITY_ONLY + PDF/CSV; preview 50 dòng live; **responseType: blob** + tải file với watermark+SHA-256 footer |
| `/admin/security-alerts` | 25 | ✅ | banner SECURE/COMPROMISED + integrity scan + **Lockdown hold-to-confirm 3s** + release |
| `/admin/policies/builder` | 21+22 | ✅ | list policies + Builder live-JSON + Simulator highlight matched rule |
| `/projects/:pid/releases` | 19 | ✅ | bảng + modal khởi tạo |
| `/projects/:pid/releases/:rid` | 20 | ✅ | checklist ✓/✗ + Export polling → download |

**Shared widgets (FSD):**
- `shared/ui/PasswordStrengthMeter.tsx` — 5-rule checklist + meter, export `isPasswordStrong()` khớp regex backend.
- `shared/ui/OtpInput.tsx` — 6 ô vuông OTP với paste, auto-advance, Backspace nhảy ngược, onComplete callback.

**🎉 Đã đủ 25/25 page lõi + 26 luồng nghiệp vụ — Frontend COMPLETE.**

**Backend limitation note:**
- `POST /projects` chỉ cho `user.title === 'Project Manager'` HOẶC admin tạo dự án (kiểm trong `ProjectsService.canCreateProject`).
- `GET /admin/users` search-user yêu cầu AdminGuard → PM thường (không phải admin) không gọi được trong AddMemberModal & Wizard Step 2. Phải nâng admin hoặc thêm endoint riêng. Hiện UI hiển thị thông báo lỗi đầy đủ khi 403.

---

## 2. Hạ tầng & cấu hình đã thiết lập

### 2.1 Docker Compose stack (`docker-compose.yml`)
| Service | Container | Image / Build | Port | Vai trò |
|---|---|---|---|---|
| Postgres | `vdt-postgres` | `postgres:16-alpine` | 5432 | DB (Hash Chaining triggers + Append-only + Partitioning) |
| Redis | `vdt-redis` | `redis:7-alpine` | 6379 | session, blacklist, abac cache, BullMQ, document locks, system:lockdown |
| MinIO | `vdt-minio` | `minio/minio:latest` | 9000/9001 | S3 storage, **SSE-S3 AES-256** (KMS single-key) |
| MinIO setup | `vdt-minio-setup` | `minio/mc:latest` | – | tạo bucket `vdt-docs` + bật auto-encryption |
| Backend API | `vdt-api` | `./backend/Dockerfile` | 3000 | NestJS 10 (chỉ chạy api khi `APP_ROLE=api`) |
| Worker | `vdt-worker` | `./backend/Dockerfile` | – | BullMQ processors: extractor / mailer / archiver / integrity-checker |
| Diff Engine | `vdt-diff-engine` | `./diff-engine/Dockerfile` | 8000 | FastAPI + difflib (Luồng 18 keep-alive) |
| Frontend (prod) | `vdt-frontend` | `./frontend/Dockerfile` | 80 | bundle Vite + Nginx serve tĩnh |
| Nginx | `vdt-nginx` | `nginx:1.27-alpine` | 80/443 | reverse proxy + TLS 1.3 + rate limit |

> Lưu ý: trong quá trình demo chúng ta đã chạy bằng **manual `docker run`** với volume mount source code cho hot dev (`vdt-api-test`, `vdt-worker-test`, `vdt-frontend-dev`) thay vì build image qua compose. Compose đã sẵn nhưng chưa được dùng cho 1-lệnh `make up` đầy đủ.

### 2.2 Database (Supabase-compatible PostgreSQL 15+)
- **14 bảng** chuẩn theo thiết kế: `departments`, `profiles`, `casbin_rule`, `projects`, `project_members`, `folders`, `documents`, `document_versions`, `audit_logs` (PARTITIONED), `project_templates`, `template_folders`, `releases`, `release_document_versions`, `user_project_preferences`.
- **8 native enum types**: `user_status`, `auth_provider`, `clearance_level`, `project_status`, `project_role`, `security_level`, `document_status`, `release_status`. Prisma map snake_case qua `@@map`.
- **`audit_logs` PARTITION BY RANGE (timestamp)**: 12 partition theo tháng 2026 + `audit_logs_default`. Hàm `create_audit_partition(year, month)` để mở partition mới.
- **Hash Chaining trigger** `compute_audit_hash`: tự tính `current_hash = SHA256(previous_hash || row content)` (FR-5.2).
- **Append-only trigger** `prevent_audit_mutation`: chặn UPDATE/DELETE trên audit_logs (NFR-1.3).
- **Trigger `set_updated_at`** trên `documents`.
- **GIN pg_trgm indexes** cho Global Search.
- **Optional Supabase-only** (`supabase/optional/`): RLS policies + `handle_new_user` sync `auth.users` → `profiles`.
- **Seed**: Admin Root (`admin@viettel.com.vn` / `Admin@123456`, bcrypt qua `pgcrypto`), phòng ban "An ninh thông tin", template SOFTWARE_DEV (4 root folders + locked flags), **Casbin grouping `g, <admin_id>, role_admin`** + policy `p, role_admin, /*, *`.

### 2.3 Backend infra adapters (`backend/src/infra/`)
- `database/prisma.service.ts` — Prisma Client + onModuleInit `$connect()`.
- `cache/redis.service.ts` — ioredis client.
- `storage/minio-s3.service.ts` — **2 S3 client**: `internal` (`http://minio:9000`) cho server-to-server (worker/diff-engine); `publicS3` (`MINIO_PUBLIC_ENDPOINT=http://localhost:9000`) sinh presigned URL cho browser. SigV4 ký HOST header → 2 client là bắt buộc.
- `abac/casbin-enforcer.service.ts` — Casbin engine với **model RBAC + keyMatchPath custom function**; Prisma adapter persist vào `casbin_rule`; addPolicy/removePolicy/grouping/reloadPolicy.
- `queue/queue.module.ts` — **4 BullMQ queues**: `text-extraction`, `mailer`, `release-export`, `integrity-scan`.

### 2.4 Core Security (`backend/src/core/`)
- **3 global guards (theo thứ tự):**
  1. `Lockdown503Guard` — check Redis `system:lockdown`; cho phép IP trong `LOCKDOWN_SAFE_IP`.
  2. `JwtAuthGuard` — Bearer + cookie `access_token`; check blacklist `blacklist:<jti>`.
  3. `CasbinAbacGuard` — enforce qua Casbin (kích hoạt khi `ABAC_ENABLED=true`; mặc định false để dev).
- **Controller-level guard:** `AdminGuard` — kiểm `casbin.getRolesForUser` chứa `role_admin`.
- **2 global interceptors:** `TimeoutInterceptor` (30s mặc định), `AuditHashInterceptor` (route có `@Audit(action)` → ghi log; Hash Chaining DB tự lo).
- **Global filter:** `GlobalExceptionFilter` — map Prisma P2002→409, P2025→404, P2003→400; FR-4.2.1 thông báo từ chối chung chung.
- **Decorators:** `@Public()`, `@Audit(action)`, `@CheckPolicy(action)`, `@CurrentUser()`.

### 2.5 BullMQ Workers (`backend/src/workers/`)
| Processor | Queue | Nhiệm vụ |
|---|---|---|
| `ExtractorProcessor` | `text-extraction` | `pdf-parse`/`mammoth`/utf-8 → upload raw_text về MinIO |
| `MailerProcessor` | `mailer` | Nodemailer (dev: log OTP/review result) |
| `ArchiverProcessor` | `release-export` | kéo file MinIO → `archiver` zip stream → upload .zip + Redis `release:export:<id>` |
| `IntegrityCheckerProcessor` | `integrity-scan` | Keyset Pagination 1000/lô; SHA-256 từng row dùng STORED `previous_hash`; phát hiện sửa lén → `corruptedRowId` |

### 2.6 Frontend (React + Vite + Tailwind, FSD)
- **State:** zustand `useSessionStore` với `persist` localStorage (`vdt-session`).
- **HTTP:** axios `baseURL=/api/v1`, interceptor inject Bearer; clear session + redirect khi 401.
- **Routing:** `react-router-dom` v6 với `ProtectedRoute` (+ `adminOnly`).
- **Layout:** `MainLayout` sidebar (Dashboard, Dự án, Diff, Admin: Audit/Tamper/Builder) + topbar (user info + Logout).
- **Vite proxy:** `/api` → backend; target qua env `VITE_API_TARGET` (cho phép chạy vite trong container).

### 2.7 File cấu hình & vận hành
- `.env.example` (root) — toàn bộ biến: DB, Redis, MinIO + **`MINIO_PUBLIC_ENDPOINT=http://localhost:9000`**, JWT secrets, Google SSO, SMTP, ABAC TTL, lockdown, KMS_SECRET_KEY (single-key SSE-S3), **không có comment inline trên dòng giá trị** (sau khi sửa bug).
- `.gitignore` — `.env`, certs, node_modules, dist.
- `Makefile` — `env`/`gencert`/`up`/`down`/`build`/`logs`/`ps`/`restart`/`migrate`/`seed`/`install`.
- `infra/nginx/nginx.conf` — TLS 1.3 ép, HSTS, rate-limit `/api/`, reverse proxy → backend:3000 và frontend:80.
- `infra/minio/setup.sh` — `mc mb` bucket + `mc encrypt set sse-s3` (cần KMS).
- `infra/postgres/init-full-text.sql` — đã hợp nhất vào `supabase/migrations/`.
- `supabase/migrations/` — 4 file init schema + audit integrity + triggers + trgm indexes. `supabase/optional/` — RLS + auth.users sync. `supabase/seed.sql`.
- `docs/architecture/` — **README.md mục lục + 26 file .md** bóc tách từng luồng (Layout / UX / Frontend / Backend API / Under the Hood).

---

## 3. Database (Supabase Managed) + Demo credentials

**Database = Supabase Cloud Postgres (KHÔNG còn Postgres local trong compose):**
- Project ref: `xfbrikkradopwjaoprrd` · Region: `ap-south-1` (Mumbai, AWS)
- Connection mode (Supavisor pooler — IPv4 ready):
  - `DATABASE_URL` = port **6543** (transaction pooler, `?pgbouncer=true`) → app runtime
  - `DIRECT_URL` = port **5432** (session pooler) → cho `prisma migrate` + `make db-bootstrap`
- **Direct DB hostname `db.<ref>.supabase.co` chỉ resolve IPv6** → Docker container không reach → BẮT BUỘC dùng pooler.

**Setup schema (1 lần):**
```bash
make db-bootstrap   # apply 4 SQL migrations + seed lên Supabase qua DIRECT_URL
# Hoặc factory reset:
make db-reset       # DROP public schema + re-apply (DESTRUCTIVE)
```

**5 user Gmail seed sẵn (tất cả mật khẩu = `Admin@123456`):**
```
minhchoi2004@gmail.com         (Admin Root          — CONFIDENTIAL, role_admin)
nguyenhuutuon2@gmail.com       (Project Manager     — CONFIDENTIAL)
duccccccc123123@gmail.com      (Developer           — INTERNAL)
ducngominh2k4@gmail.com        (Senior Reviewer     — INTERNAL)
daudau842640@gmail.com         (Contributor         — INTERNAL)
```

**Quan trọng — không còn ràng buộc domain:**
- `ALLOWED_EMAIL_DOMAIN` mặc định = `''` (trống) → chấp nhận MỌI email (kể cả @gmail.com, @outlook.com, …).
- Domain restriction là **opt-in**: chỉ set khi deploy enterprise muốn ép nội bộ.
- Register + Forgot Password + Google SSO đều hoạt động với email Gmail bình thường.

**Dữ liệu mẫu khi seed lần đầu:**
- 2 phòng ban: `An ninh thông tin` (admin) + `Khối Phát triển Phần mềm` (4 user còn lại).
- 1 template: `SOFTWARE_DEV` với 4 thư mục gốc (01_SRS, 02_Design, 03_API_Spec locked + 04_Test unlocked).
- Sau khi PM/Admin tạo dự án sẽ có thêm Casbin grouping + folder structure.

---

## 4. Hạ tầng đang chạy (snapshot)

**Mode A — Production (1-lệnh `make up` / `docker compose up -d --build`):**
```
# DB managed off-host (Supabase cloud, không trong compose)
vdt-redis        (healthy)  → 6379
vdt-minio        (healthy)  → 9000/9001 (admin console)
vdt-minio-setup  (exit)     → bucket + SSE-S3 setup ran once
vdt-diff-engine  (up)       → 8000
vdt-api          (up)       → 3000 (qua Nginx proxy /api/) → Supabase pooler 6543
vdt-worker       (up)       → BullMQ worker → Supabase pooler 6543
vdt-frontend     (up)       → 80 (qua Nginx proxy /)
vdt-nginx        (up)       → 80 (→ 301 https) + 443 (TLS 1.3)
```
Tổng: **7 container compose + 1 Supabase managed**. Truy cập demo: **https://localhost/**.

**Mode B — Dev (manual `docker run` với volume mount, HMR):**
```
vdt-postgres / vdt-redis / vdt-minio / vdt-diff-engine (compose)
vdt-api-test       (manual)  → 3000  (mount /backend)
vdt-worker-test    (manual)  → –     (mount /backend, APP_ROLE=worker)
vdt-frontend-dev   (manual)  → 5173  (Vite dev + HMR)
```
Truy cập demo: **http://localhost:5173/** (proxy /api → host backend:3000).

**Switch giữa 2 mode:**
- Sang prod: trong `.env` đổi `MINIO_PUBLIC_ENDPOINT=https://localhost` + `APP_BASE_URL=https://localhost` → `docker compose up -d --build`.
- Sang dev: đổi `.env` về `http://localhost:9000` + `http://localhost` → `docker compose stop nginx frontend backend worker` rồi manual run 3 container.

---

## 5. Việc dang dở / Next steps

### 5.1 ~~Đang dở giữa chừng~~ — **HOÀN TẤT**
- ✅ **Nginx + 1-command deploy (NFR-3.2):** `make up` chạy toàn stack 9 service qua docker compose (auto gen cert + .env). Đã verify:
  - 9/9 service Up (postgres+redis+minio healthy; backend/worker/nginx/frontend/diff-engine running).
  - TLS 1.3 enforced (`openssl s_client` báo `Protocol: TLSv1.3, Cipher: TLS_AES_256_GCM_SHA384`).
  - HTTP 80 → 301 redirect HTTPS 443.
  - `/api/v1/auth/login` qua HTTPS → 200 + JWT.
  - `/api/v1/admin/audit-logs/export` PDF/CSV stream qua HTTPS → file 45KB/2KB với watermark + SHA-256 footer.
  - **Presigned URL từ browser qua /vdt-docs/ regex → MinIO** → 200 OK file content thật (`text/markdown` 100 bytes raw_text).
  - Rate-limit Nginx auth_limit 5r/s burst 10: 3 request đầu pass (401), từ req 4 trả 429.
  - `/healthz` → 200 ok cho external load balancer.

### 5.2 Frontend còn thiếu UI (backend đã sẵn sàng — chỉ cần dựng page)
**Admin (ưu tiên báo cáo):**
- `/admin/users` Luồng 7 — User Directory + bulk-status/bulk-attributes.
- `/admin/users/:userId/attributes` Luồng 8 — gán phòng ban/title/clearance (kích hoạt thật force-logout).
- `/admin/departments` Luồng 9 — CRUD departments.
- `/admin/project-templates` Luồng 26 — Template Tree Builder (drag-and-drop reorder + lock icon).

**Workflow tài liệu (đủ để demo trọn vòng đời):**
- `/projects/create` Luồng 11 — Wizard 2 bước (chọn template + gán team).
- `/projects/:pid/team` Luồng 13.
- `/projects/:pid/settings` Luồng 14 — Danger Zone Archive với gõ tên xác nhận.
- `/projects/:pid/documents/upload` Luồng 15 — Dropzone + progress + metadata form.
- `/documents/:docId/detail` Luồng 16 — 3 tabs Preview/Metadata/Version Timeline.
- `/documents/:docId/review` Luồng 17 — Split screen Approve/Reject.

**Auth còn lại:**
- `/auth/register` Luồng 2 — Stepper 2 bước (info → OTP).
- `/auth/forgot-password` Luồng 3 — Stepper 3 bước.
- `/profile` Luồng 5 + `/profile/security` Luồng 6.

**Admin export:**
- `/admin/audit-logs/export` Luồng 24 — UI cấu hình startTime/endTime/format/scope rồi tải.

### 5.3 Tối ưu kỹ thuật còn nợ
- **ABAC eval-style policies (Luồng 22 advanced):** Hiện model là RBAC + keyMatchPath. Doc 22 còn nhắc tới `eval(r.sub.department=='QA' && r.ctx.hour>=8)` cho giờ-hành-chính/clearance. Cần model hybrid `[matchers] m = m1 || m2` cho 2 ptype hoặc migrate hoàn toàn sang eval. Builder hiện hoạt động ở mức RBAC role + path pattern.
- **Worker scaling/queueing concerns:** `release-export` đang single-instance; nếu zip rất to (>500MB) nên stream trực tiếp lên MinIO thay vì gom buffer trong RAM.
- **PDF Audit Export font Unicode:** đang strip non-Latin1 (thay '?'). Để hiển thị tiếng Việt cần nhúng font (DejaVu Sans / Noto Sans).
- **MinIO public endpoint qua Nginx:** hiện browser hit thẳng `localhost:9000`. Production nên proxy qua Nginx `/storage/` → MinIO (giữ signed URL hợp lệ bằng cách dùng Nginx host trong endpoint).
- **Refresh token rotation race:** đang dùng advisory Redis SET; nếu 2 tab refresh đồng thời sẽ rotation 1 cái và làm token cái kia thành "đã thu hồi" → kích hoạt revoke all sessions. Cần grace window 5-10s cho jti vừa rotation.
- **Frontend Vite HMR trên Windows bind mount** không bắt được file change ổn định — workaround `docker restart vdt-frontend-dev` sau khi sửa file frontend. Production bundle qua Nginx không gặp.
- **Backend chạy qua compose (`docker compose up -d backend worker`)** chưa được kiểm chứng — đang chạy bằng manual `docker run` mount source. Cần build image full + test một lần.

---

## 6. Các bug đã gặp & cách fix (lưu để không lặp)

| Bug | Module | Cách fix |
|---|---|---|
| Inline comment trong `.env` → `Number()` ra NaN → multer truncate file về 0 byte & enqueue điều kiện `< NaN` luôn false | Documents upload | Bỏ comment inline sau giá trị số trong `.env.example`; `docker restart` không reload `--env-file` → phải recreate container |
| MinIO PutObject `ServerSideEncryption: AES256` lỗi "KMS not configured" | MinIO | Thêm `MINIO_KMS_SECRET_KEY=key:<base64-32-bytes>` cho MinIO container |
| Prisma engine `linux-musl` thiếu `libssl.so.1.1` trên Alpine OpenSSL 3 | Backend Docker | `binaryTargets=["native","linux-musl-openssl-3.0.x"]` + `apk add openssl` |
| Prisma enum PascalCase vs DB type snake_case → INSERT fail `type "AuthProvider" does not exist` | Prisma schema | `@@map("auth_provider")` cho cả 8 enum |
| `tsc incremental: true` + `deleteOutDir: true` → nest build chỉ emit file đã thay đổi → thiếu file ở dist | Backend build | Tắt `incremental` |
| `casbin-prisma-adapter@^1.4.0` resolve 1.12 yêu cầu Prisma 7 | package.json | Pin `casbin-prisma-adapter: "1.6.0"` (Prisma 5 line) |
| Multer empty buffer khi `forbidNonWhitelisted` ValidationPipe | (false alarm, thực ra do NaN limit) | – |
| `is_locked` template folder + delete: stored `v3=''` ≠ NULL → `removePolicy` không match | Policies delete | Fallback xóa thẳng Prisma theo id nếu `removePolicy` trả false |
| `ORDER BY id ASC` với alias `id::text AS id` → Postgres sort theo TEXT lex (1, 10, 11, 2, ...) | Integrity scan | Đổi alias `rowId`; ORDER BY id (bigint cột gốc) |
| Hash chain order ≠ id order (trigger DB chọn prev theo `(timestamp DESC, id DESC)`; insert đồng thời gây xáo trộn) | Integrity scan | Per-row verification dùng **stored `previous_hash`** thay vì track theo id; + check chain continuity |
| pdf-lib Helvetica WinAnsi không có glyph 'ả' (0x1ea3) | Audit PDF export | `toAscii(s)` strip non-Latin1; production nhúng Unicode font |
| `archiver` ESM import `* as archiver` không callable | Release archiver | `import archiver from 'archiver'` (default) |
| pdf-parse top-level side-effect (đọc file test khi require) | Document extraction worker | `require('pdf-parse/lib/pdf-parse.js')` (sub-path) |
| `curl -w "%{http_code}"` báo 000 trên response streaming | Test PDF export | Dùng `curl -v` để xác minh; thực tế server trả 200 |
| `docker restart` KHÔNG nạp lại `--env-file` | Recreate container | `docker rm -f` + `docker run` lại |
| Vite HMR Windows bind mount thường miss file events | Frontend dev | `docker restart vdt-frontend-dev` sau khi sửa file |
| MinIO presigned URL host=`minio:9000` không reach từ browser | Diff Original-view | 2 S3 client: `internal` (worker/diff-engine) + `publicS3` (browser) |
| Đăng nhập GoogleStrategy yêu cầu clientID khác null khi bootstrap | Auth Google SSO | Fallback `'not-configured'`; `GoogleAuthGuard` ném 503 nếu env trống |
| Bcrypt seed trong SQL | DB seed | `crypt('Admin@123456', gen_salt('bf', 10))` qua `pgcrypto` (compatible với Node bcrypt) |
| MinIO `mc encrypt set sse-s3` yêu cầu KMS — fail "KMS not configured" lần đầu | minio-setup | Thêm `MINIO_KMS_SECRET_KEY` rồi recreate minio + minio-setup |

---

## 7. Lệnh / thao tác phổ biến

### 7.1 Production: 1-lệnh deploy (NFR-3.2)
```bash
make up                # auto gen cert + .env + docker compose up -d --build
make verify            # smoke-test healthz + login + SPA
make logs              # log realtime
make down              # dừng (giữ volume)
make clean             # dừng + xóa volume (RESET DB)
```
Hoặc không có make:
```bash
# Sinh cert lần đầu (nếu chưa có)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/nginx/certs/tls.key -out infra/nginx/certs/tls.crt \
  -subj "/C=VN/ST=Hanoi/L=Hanoi/O=Viettel/CN=dms.viettel.local" \
  -addext "subjectAltName=DNS:dms.viettel.local,DNS:localhost,IP:127.0.0.1"

cp .env.example .env   # 1 lần
docker compose up -d --build
```

### 7.2 Dev mode: manual run với mount source (HMR)
```bash
# === Khởi động hạ tầng (postgres+redis+minio+diff-engine) ===
docker compose up -d postgres redis minio minio-setup diff-engine

# === Build & chạy backend (manual mount, hot for dev) ===
docker run --rm -v "D:/WEB SEC/backend":/app -w /app node:20-alpine \
  sh -c "npm install && rm -rf dist && npm run build"
docker run -d --name vdt-api-test --network websec_default \
  --env-file "D:/WEB SEC/.env" -p 3000:3000 \
  -v "D:/WEB SEC/backend":/app -w /app node:20-alpine \
  sh -c "apk add --no-cache openssl && node dist/main.js"

# === Chạy worker (cùng image) ===
docker run -d --name vdt-worker-test --network websec_default \
  --env-file "D:/WEB SEC/.env" -e APP_ROLE=worker \
  -v "D:/WEB SEC/backend":/app -w /app node:20-alpine \
  sh -c "apk add --no-cache openssl && node dist/workers/main.worker.js"

# === Chạy frontend dev (Vite) ===
docker run -d --name vdt-frontend-dev \
  -e VITE_API_TARGET=http://host.docker.internal:3000 \
  -p 5173:5173 --add-host=host.docker.internal:host-gateway \
  -v "D:/WEB SEC/frontend":/app -w /app node:20-alpine \
  sh -c "npm run dev -- --host 0.0.0.0"

# === Tamper test (Hash Chain demo) ===
docker exec vdt-postgres psql -U vdt_admin -d vdt_dms -c "
  SET session_replication_role = replica;
  UPDATE audit_logs SET fail_reason='HACKED' WHERE id=5;
  RESET session_replication_role;"
# Hoàn nguyên:
docker exec vdt-postgres psql -U vdt_admin -d vdt_dms -c "
  SET session_replication_role = replica;
  UPDATE audit_logs SET fail_reason='Sai email hoặc mật khẩu' WHERE id=5;
  RESET session_replication_role;"

# === Reset toàn bộ DB ===
docker compose down -v
docker compose up -d postgres
```

---

## 8. Việc tiếp theo

✅ **Phase 4 đã hoàn tất 100%:**
- 25/25 page lõi + 1 bonus (Templates Tree Builder).
- Nginx production + `make up` 1-lệnh deploy (NFR-3.2 verified).
- TLS 1.3 enforced, presigned URL qua proxy, rate-limit auth_limit/api_limit hoạt động.

### Phase 5 — Bug-fix Sprint (đang chạy: A→B→C→D→E)

**✅ Phase A — Critical Security & Logic bugs (5/5 fixed, verified E2E):**
- A1 OTP enforcement: backend đã có `if (!valid) throw BadRequestException`. Verified test OTP sai → 400.
- A2 Real SMTP Gmail: cấu hình `SMTP_HOST=smtp.gmail.com` + App Password `pwjonyipjkrrgwhv` (no spaces). Log `[SMTP] ✓ Đã gửi ... messageId=<...>@gmail.com` xác nhận email thật gửi đi.
- A3 Audit log IP: thêm `ipAddress: ip` cho `DOWNLOAD_SUCCESS/DENIED` + `PROJECT_UPDATED/ARCHIVED/RESTORED`. Verify log mới `id=207,208` có IP `172.18.0.1`.
- A4 Release compliance đệ quy: `scoreCompliance` + `getCompliance` đã BFS subtree → doc trong `01_SRS/Vong_1/x.pdf` cũng tính cho `01_SRS`. Export cho phép cả khi project ARCHIVED (release là immutable snapshot).
- A5 Doc trùng tên: thêm check `findFirst({title, folderId, isDeleted:false})` ở upload service. Verify upload trùng → 400 với message gợi ý "Upload version mới".

**✅ Phase B — Member management + UX critical (7/7 fixed, verified E2E):**
- B1 Backend 2 endpoint search nhân sự không cần Admin:
  - `GET /profile/searchable?q=...` (mọi user authenticated) — cho Wizard tạo project (chưa có project context).
  - `GET /projects/:pid/members/searchable?q=...` (yêu cầu Manager/Admin) — auto exclude existing members.
  - Verify: PM `nguyenhuutuon2@gmail.com` search thấy 2 user khớp "duc"; `/admin/users` vẫn 403 (đúng spec) nhưng giờ có endpoint riêng.
- B2 Frontend `ProjectCreatePage` + `AddMemberModal` đã trỏ endpoint mới — hết bug "PM không tải được danh bạ".
- B3 UI tạo thư mục mới trong `FolderPage` — modal dialog với name input + parent context; verify PM tạo "PhaseB_TestFolder" thành công.
- B4 `documents.service.getDetail` trả thêm `projectId/folderId`; sửa link "Upload version mới" trong `DocumentDetailPage` → trỏ đúng `/projects/<pid>/documents/upload?docId=...&folderId=...` thay vì alert.
- B5 Redesign topbar:
  - 3 chip rõ ràng "Phòng ban: X / Chức danh: Y / Cấp bảo mật: Z" với màu phân biệt clearance (CONFIDENTIAL = đỏ, INTERNAL = xanh dương, PUBLIC = xám).
  - Avatar click → dropdown menu với Hồ sơ / An toàn / Đăng xuất + thông tin auth provider.
  - Auto-close dropdown khi click ngoài.
- B6 `shared/ui/BackButton.tsx` smart: nếu `to` được truyền → navigate force; nếu không → `history.back()` hoặc fallback `/dashboard`. Áp dụng Settings/Team/Detail/Review/Upload.
- B7 Build backend + frontend mới, 7/7 service Up, smoke-test 4 luồng PASS.

**✅ Phase C — Preview/Edit/Diff + Google SSO (7/7 fixed, verified E2E):**
- C1 Preview inline cho .md/.txt: thêm `getPresignedPreviewUrl()` ở MinioS3Service với `ResponseContentDisposition=inline` + `ResponseContentType=text/plain` override; endpoint mới `GET /documents/:docId/versions/:vid/preview` (không ghi DOWNLOAD audit). Verify response header: `Content-Type: text/plain; charset=utf-8` + `Content-Disposition: inline`.
- C2 Hiển thị .docx: cài `mammoth@1.12` + type stub `src/types/mammoth.d.ts`; `DocxPreview` fetch blob → `mammoth.convertToHtml({arrayBuffer})` → render trong `<div className="prose">`.
- C3 Xem version cũ: thêm nút "👁 Xem" trên mỗi row Version Timeline → modal `VersionPreviewModal` render đúng theo fileType (PDF iframe / MD marked / TXT pre / DOCX mammoth). Thêm nút "🗑 Xóa" tài liệu trong header (gọi `DELETE /documents/:id` soft delete).
- C4 Online text editor: textarea editable khi user holding lock + fileType in {md, txt}; nút "Lưu thành phiên bản mới" tạo Blob+File rồi POST upload với cùng `documentId` (kế thừa title/folder/security từ doc cũ).
- C5 Verify edit-by-upload-version + Diff: tạo doc test v1 + v2 thật, gọi `GET /documents/:id/diff?v1=1&v2=2` → trả `originalUrls.v1Url/v2Url` + `meta` + presigned URL hợp lệ. Sửa link Diff trong DocumentDetailPage từ `vA/vB` UUID → `v1/v2` versionNo number (match backend `ParseIntPipe`).
- C6 Google SSO:
  - Backend: thêm `GOOGLE_CLIENT_ID=130108135299-...` + `GOOGLE_CLIENT_SECRET=GOCSPX-...` vào `.env`; sửa redirect target thành `/auth/sso-callback?token=...` (gọn hơn `/dashboard?token=...`).
  - Frontend: nút "Đăng nhập với Google" SVG đẹp + divider "HOẶC" trong LoginPage; trang `SsoCallbackPage` xử lý: lấy token từ query → setSession tạm → gọi `/profile` → setSession đầy đủ với user info → redirect `/dashboard`. Flash banner `error=sso_denied` cho fail case.
  - Verify: `GET /api/v1/auth/google` → 302 → `https://accounts.google.com/o/oauth2/v2/auth?client_id=130108135299-...&redirect_uri=https://localhost/api/v1/auth/google/callback&scope=email%20profile`.
- C7 Rebuild + E2E: 7/7 service Up, TS clean, preview MD content-type/disposition đúng, diff trả originalUrls, Google OAuth redirect hợp lệ.

**✅ Phase D — Bổ sung features (7/7 done, verified E2E):**
- D1 Dashboard "My Locks" card: backend `GET /dashboard/my-locks` scan Redis `doc:lock:*` keys với pipeline + mget TTL; FE poll 60s + nút "Trả khóa" inline.
- D2 Upload nguyên thư mục: `UploadFolderModal` dùng `<input webkitdirectory>` parse `file.webkitRelativePath` → tạo folder tree đệ quy (ensureFolderPath với cache) → upload song song; skip file > 50MB hoặc định dạng không hỗ trợ.
- D3 Public profile page: backend `GET /profile/public/:userId` trả minimal info; FE `UserPublicProfilePage` với gradient header + 7 field; FolderPage + DocumentDetailPage thêm Link "🔒 Đang bị sửa bởi user X" → `/users/X`. Test E2E: lấy public profile của PM trả `fullName/department/title/clearance/authProvider` đầy đủ.
- D4 "Xin trả khóa": backend `POST /documents/:id/lock/request-release` với reason ≥10 ký tự; anti-spam 1h/user/doc qua Redis; gửi email cho lock owner qua MailService (subject "có YÊU CẦU TRẢ KHÓA"); DocumentDetailPage thêm nút "🙏 Xin trả khóa" + modal nhập reason. Verify SMTP log: `[SMTP] ✓ Đã gửi VDT DMS — Tài liệu "X" — có YÊU CẦU TRẢ KHÓA → nguyenhuutuon2@gmail.com`.
- D5 Tạo file trống: `CreateEmptyFileModal` cho phép tạo .md/.txt/.docx ngay từ FolderPage; tự upload Blob rỗng (md có template `# Tài liệu mới`); sau khi tạo redirect detail page để user lock + edit ngay.
- D6 Policy Builder UX:
  - Trang `/admin/policies/guide` mới với 6 section: ABAC+Casbin căn bản, cấu trúc luật, 5 ví dụ thực tế, workflow, p vs g, lưu ý quan trọng.
  - PolicyBuilderPage thêm nút "📖 Hướng dẫn chi tiết" + collapsible "❓ Đọc nhanh trước khi tạo luật".
- D7 Hash Chain explainer: TamperHubPage thêm collapsible "❓ SYSTEM INTEGRITY SECURE nghĩa là gì?" với 5 section + demo "thử tamper" command Postgres bypass trigger để banner đỏ.
- D8 Build + recreate + smoke-test: 7/7 service Up, TS clean, 3/3 endpoint mới verified, SMTP gửi mail thật cho PM khi xin trả khóa.

**✅ Phase E — Báo cáo Word + Slides (2/2 done):**
- E1 Báo cáo Word: `reports/BaoCao_VDT_DMS.docx` (47KB, ~43-61 trang)
  - **Chương 1** Phân tích nghiệp vụ (8 trang, 20%): bối cảnh, mục tiêu, 5 actors, 26 luồng, FR (6 nhóm), NFR (6 yêu cầu), Use Case Diagram.
  - **Chương 2** Thiết kế hệ thống (28 trang, 80%): kiến trúc 4 lớp, tech stack (13 công nghệ), ERD chi tiết (13 bảng + 8 enum), Package Diagram, Class Diagram module Auth, **5 Sequence Diagrams** (Login, Upload, Approve, Diff, Tamper Detection), bảng 25 màn hình UI, 7 cơ chế bảo mật (ABAC+Casbin, Hash Chain, Append-only, JWT, SSE-S3, Anomaly Detection, Lockdown), FSM workflow, deployment 1-lệnh.
  - **Chương 3** Phụ lục (~10 trang): bảng đặc tả API REST 60+ endpoint, 8 enum types, 12 Redis key prefix, 17 bug đã fix với cách giải quyết, cấu trúc thư mục, lệnh Makefile, demo credentials, 14 Pinned Architecture Decisions.
  - Generated qua docx-js: 1121 paragraphs + 27 tables + 5 page breaks; A4 với header/footer + TOC tự động.
- E2 Slides PowerPoint: `reports/Slides_VDT_DMS.pptx` (765KB, **25/25 slides**)
  - Theme: Navy `#0F2A4D` + Viettel Red `#E60012` + Teal `#14B8A6`; LAYOUT_WIDE 13.33"×7.5".
  - 1. Title page (dark navy + red accent bar)
  - 2. Outline 8 phần với numbered badge
  - 3. Bối cảnh — 3 problem cards + quote box
  - 4. Mục tiêu 6 trụ cột với icon trong circle
  - 5. Kiến trúc 4 lớp visualization stacked
  - 6. Tech Stack 8 categories
  - 7. ERD overview 12 bảng grid
  - 8. 26 luồng overview 5 nhóm
  - 9-11. Chi tiết 25+1 luồng (Nhóm 1+2, Nhóm 3+4, Nhóm 5+Bonus)
  - 12. ABAC+Casbin (model + ví dụ luật)
  - 13. Hash Chaining (chain diagram + 3 tầng bảo vệ — dark slide)
  - 14. SSE-S3 AES-256 (5 step flow + verify code)
  - 15. JWT + Mass Session Eviction (< 1 giây big stat)
  - 16. FSM Workflow (4 state + transitions + REJECT loop)
  - 17. Diff Engine Python (pipeline + code snippet)
  - 18. BullMQ 4 queues
  - 19. Anomaly Detection + Emergency Lockdown
  - 20. Deployment `make up` (big command + 7 service grid)
  - 21. NFR 6/6 đã đạt với evidence
  - 22. Demo screenshots placeholder (6 màn hình)
  - 23. Tổng kết 8 big stat cards
  - 24. Hướng phát triển 6 cards
  - 25. Thank You + Q&A (dark slide)

**🎉 Đồ án VDT Zero-Trust DMS HOÀN THÀNH 100% sau 5 Phase Bug-fix Sprint** (A→E).
- Codebase: 12 backend module + 25+5 frontend page + 4 BullMQ worker + 1 Python microservice.
- Deployment: 7 service Docker Compose + Supabase Cloud + 1-lệnh `make up`.
- Documents: PROGRESS.md (tracker) + GUIDE.md (vận hành) + reports/BaoCao_VDT_DMS.docx (40+ trang Word) + reports/Slides_VDT_DMS.pptx (25 slides).

**Còn lại Phase C, D, E:**
- C: Preview/Edit/Diff (#1, #2, #3, #7, #8, #11, #16, #12 Google SSO)
- D: Bổ sung features (Dashboard locked docs, Click locked-by → profile, Request unlock, Create empty file, Upload folder, Policy guide, Hash Chain explainer)
- E: Báo cáo Word 40 trang + Slides 25 trang (skill docx + pptx)

**Có thể làm thêm (tùy nhu cầu):**
- Đổi tên domain từ `localhost` → `dms.viettel.local` + cập nhật `/etc/hosts` cho demo gần production.
- Real SMTP server thay log dev (Nodemailer mailtrap/sendgrid).
- Embed font Unicode (DejaVu Sans/Noto Sans) cho PDF Audit Export hiển thị tiếng Việt đầy đủ.
- Hybrid Casbin model (RBAC + eval ABAC) cho điều kiện giờ giấc/IP context (xem PROGRESS §5.3).
- Stream zip release thẳng lên MinIO thay vì gom buffer trong RAM (khi file >500MB).
- Grace window 5-10s cho refresh token rotation race-condition (tránh revoke khi 2 tab refresh đồng thời).

---

_Cập nhật lần cuối: phiên chat khởi tạo PROGRESS.md. Khi resume hãy đọc file này trước, kiểm tra `docker ps`, rồi quyết định hướng tiếp._

---

## 9. Pinned Architecture Decisions — **DO NOT CHANGE without explicit user approval**

### 9.0 Database = **Supabase Managed (cloud)** (cập nhật 2026-05-28)
- KHÔNG còn service `postgres` trong docker-compose. Database là Supabase cloud project `xfbrikkradopwjaoprrd` region ap-south-1.
- Backend dùng **2 URL**: `DATABASE_URL` (pooler 6543) cho runtime + `DIRECT_URL` (pooler 5432) cho Prisma migrate.
- `schema.prisma` có `directUrl = env("DIRECT_URL")` để Prisma migrate qua session pooler.
- **Direct DB hostname IPv6-only** — KHÔNG được dùng từ container không có IPv6. Mọi connection phải qua Supavisor pooler `aws-1-ap-south-1.pooler.supabase.com`.
- Apply schema = `make db-bootstrap` (psql + 4 migration files + seed.sql). KHÔNG dùng `prisma migrate dev` (vì migrations là raw SQL có PARTITION + Trigger không biểu diễn được trong Prisma).
- Migration history: `supabase/migrations/0001-0004.sql` + `supabase/seed.sql` (source of truth).

> Đây là các quyết định kiến trúc đã được **chốt cứng** sau khi đã chạy verify E2E
> và sửa bug thực tế. Mỗi gạch đầu dòng đều đứng sau một bug đau, một cuộc tranh luận,
> hoặc một ràng buộc thiết kế. **Không được gen code phá vỡ các pin này** — nếu user
> chưa yêu cầu thay đổi rõ ràng. Nếu thấy "cách khác hay hơn", phải HỎI trước, không tự sửa.

### 9.1 ABAC engine = **Casbin RBAC + `keyMatchPath`** (KHÔNG phải eval-ABAC)
- Model file: `backend/src/infra/abac/rbac_with_keymatch.conf` (RBAC `g, user, role` + matcher `keyMatchPath(r.obj, p.obj)`).
- Adapter: `casbin-prisma-adapter` **pinned chính xác `1.6.0`** (1.7+ yêu cầu Prisma 6/7, sẽ break Prisma 5).
- Tài liệu Luồng 22 có gợi ý `eval(r.sub.department=='QA' && ...)` — **không migrate ngay**, vì sẽ break luồng Projects (Casbin grouping `g, <userId>, role_project_<projectId>`). Nếu user yêu cầu hybrid eval → cần model 2-ptype và cẩn thận test lại Luồng 11/13.
- Visual Rule Builder hiện chỉ phát rules dạng RBAC role + path pattern.

### 9.2 MinIO = **2 S3 clients** (internal + publicS3) vì SigV4 ký HOST header
- File: `backend/src/infra/storage/minio-s3.service.ts`.
- `internal` endpoint = `http://minio:9000` — dùng cho server-to-server (worker bóc text, archiver zip, diff-engine).
- `publicS3` endpoint = `MINIO_PUBLIC_ENDPOINT` (mặc định `http://localhost:9000`) — sinh presigned URL gửi BROWSER.
- Browser hit presigned được ký bởi `internal` → fail "SignatureDoesNotMatch" vì host khác.
- API duy nhất: `getPresignedDownloadUrl(key)` → publicS3; `getInternalPresignedUrl(key)` → internal. **Không gộp lại.**

### 9.3 BullMQ workers = **tách container riêng** (`APP_ROLE=worker`)
- Workers KHÔNG được register trong `AppModule` — chỉ ở `WorkerModule` (`backend/src/workers/`).
- Entry point worker: `dist/workers/main.worker.js`. Entry point API: `dist/main.js`. Cùng 1 image, khác CMD.
- 4 queue: `text-extraction`, `mailer`, `release-export`, `integrity-scan`. Không thêm queue mới vào API.

### 9.4 Diff Engine = **Python FastAPI microservice riêng**
- Container `vdt-diff-engine` ở `diff-engine:8000`. Backend NestJS gọi qua HTTP.
- KHÔNG dùng `diff-match-patch` trong Node — đã decide vì Luồng 18 cần `difflib.SequenceMatcher.get_opcodes()` (Python chuẩn).
- Keep-alive container, không phải on-demand spawn.

### 9.5 audit_logs = **composite PK (id, timestamp), PARTITION BY RANGE (timestamp)**
- 12 partition theo tháng 2026 + 1 default. Hàm `create_audit_partition(year, month)` để mở partition mới.
- Hash Chaining = DB trigger `compute_audit_hash` (SHA256 of `previous_hash || row content`).
- Append-only = DB trigger `prevent_audit_mutation` (chặn UPDATE/DELETE, NFR-1.3).
- **KHÔNG** đổi sang single PK `id` — sẽ vỡ partitioning + lose hash chain semantics.

### 9.6 Integrity verification = **per-row STORED `previous_hash`** (KHÔNG đi theo id-order)
- File: `backend/src/workers/integrity-checker.processor.ts`.
- Lý do: trigger DB chọn prev theo `(timestamp DESC, id DESC)`; insert concurrent gây id ≠ chain order.
- Mỗi row tự verify: recompute `SHA256(stored_previous_hash || canonical(row))` và so với `current_hash` STORED.
- Bonus: check chain continuity bằng cách tra `previous_hash` tồn tại trong `current_hash` của row khác.
- SQL alias dùng `id::text AS "rowId"` (KHÔNG `AS id` vì PG sort theo TEXT lex 1,10,11,2,...).

### 9.7 Dev mode = **manual `docker run` với volume mount** (KHÔNG `docker compose up backend`)
- Vì hot reload + edit source trên Windows. Compose có build image nhưng dùng cho production stage.
- Container dev: `vdt-api-test`, `vdt-worker-test`, `vdt-frontend-dev`. Mount source: `-v "D:/WEB SEC/backend":/app`.
- Khi sửa code backend: chạy lại `npm run build` trong container `vdt-api-test`, rồi `docker restart vdt-api-test`.

### 9.8 Frontend trong container → `VITE_API_TARGET=http://host.docker.internal:3000`
- Vì backend chạy ở `vdt-api-test` bind `localhost:3000` ở host, không trong cùng network compose name (vì manual run).
- Phải kèm `--add-host=host.docker.internal:host-gateway` khi `docker run vdt-frontend-dev`.
- Production (compose `vdt-frontend` + `vdt-nginx`) thì proxy qua Nginx, không dùng biến này.

### 9.9 `.env` rules — TUYỆT ĐỐI tuân thủ
- **KHÔNG** ghi comment inline sau giá trị số:
  - ❌ `MAX_UPLOAD_BYTES=52428800   # 50MB` → `Number()` → NaN → multer truncate 0 byte (đã từng tốn 2h debug).
  - ✅ Comment ở dòng riêng phía trên.
- **`docker restart` KHÔNG nạp lại `--env-file`** — phải `docker rm -f <name>` rồi `docker run` lại với `--env-file` mới.
- `MINIO_PUBLIC_ENDPOINT=http://localhost:9000` (cho dev) hoặc qua Nginx `/storage/` (cho prod).
- `MINIO_KMS_SECRET_KEY=key:<base64-32-bytes>` BẮT BUỘC cho SSE-S3 AES-256 (NFR-1.2).

### 9.10 Repo layout — TRÁNH lạc thư mục
- Source thật: `D:/WEB SEC/backend`, `D:/WEB SEC/frontend`, `D:/WEB SEC/diff-engine`, `D:/WEB SEC/docs`, `D:/WEB SEC/supabase`, `D:/WEB SEC/infra`.
- Thư mục `D:/WEB SEC/vdt-demo/` ở root là **dự án cũ KHÔNG liên quan** — không đọc, không sửa.
- File config root: `.env`, `.env.example`, `docker-compose.yml`, `Makefile`, `PROGRESS.md`.

### 9.11 Auth — Bug-prone, đã chốt
- JWT access trong cookie HttpOnly `access_token` + Bearer header — JwtAuthGuard chấp nhận cả hai.
- Refresh cookie HttpOnly + rotation; blacklist jti qua Redis SETEX `blacklist:<jti>`.
- Google SSO: `GoogleStrategy` clientID fallback `'not-configured'` để bootstrap không crash khi env trống; `GoogleAuthGuard` throw 503 nếu env chưa cấu hình.
- Bcrypt seed = `crypt('Admin@123456', gen_salt('bf', 10))` qua `pgcrypto` (tương thích Node `bcrypt.compare`).

### 9.12 PDF / Archive — đã chốt
- pdf-lib WinAnsi không có glyph Unicode → `toAscii(s) = s.replace(/[^\x00-\xFF]/g, '?')` mọi `drawText`. Khi user yêu cầu tiếng Việt đẹp → nhúng `DejaVu Sans` hoặc `Noto Sans` (chưa làm).
- `archiver` import = `import archiver from 'archiver'` (default), KHÔNG `import * as archiver`.
- `pdf-parse` import = `require('pdf-parse/lib/pdf-parse.js')` (sub-path) để tránh side-effect ở entry.

### 9.13 Prisma — đã chốt
- `binaryTargets = ["native","linux-musl-openssl-3.0.x"]` trong `schema.prisma` + Dockerfile `apk add openssl`.
- Mọi enum phải có `@@map("snake_case")` vì PG type là snake_case còn Prisma client là PascalCase.
- `tsconfig.json` `incremental: false` (vì `deleteOutDir` + incremental khiến nest build chỉ emit file đã đổi → thiếu dist).

### 9.14 Frontend HMR Windows quirk
- Vite HMR trên Windows bind mount thường miss file events. Workaround: `docker restart vdt-frontend-dev` sau khi sửa file frontend. KHÔNG migrate sang polling vì CPU tăng vọt.

---

_Cập nhật lần cuối: hoàn tất NFR-3.2 1-command deploy + 25/25 page lõi. Toàn bộ Phase 4 kết thúc — dự án ready demo._
