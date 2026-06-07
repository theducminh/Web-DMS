# Database Schema — Supabase

Lược đồ CSDL cho VDT Zero-Trust DMS, viết để chạy trên **Supabase / PostgreSQL 15**.

## Cấu trúc thư mục
```
supabase/
├── migrations/                     # Áp dụng theo thứ tự (an toàn chạy lại — idempotent)
│   ├── 0001_init_schema.sql        # Extensions, 8 enum, 14 bảng, partition audit_logs theo tháng
│   ├── 0002_audit_integrity.sql    # Hash Chaining tự động + chặn UPDATE/DELETE (Append-only)
│   ├── 0003_triggers_updated_at.sql# Trigger documents.updated_at
│   └── 0004_search_indexes.sql     # GIN pg_trgm cho Global Search
├── optional/                       # CHỈ chạy trên Supabase (tham chiếu role/schema riêng)
│   ├── 0005_rls.sql                # Bật Row Level Security (backstop; service_role bypass)
│   └── 0006_supabase_auth_sync.sql # Trigger auth.users -> profiles (khi dùng Supabase Auth)
└── seed.sql                        # Admin Root + phòng ban + template SOFTWARE_DEV
```

## Bảng (khớp 100% phần "Database" của tài liệu thiết kế)
`departments`, `profiles`, `casbin_rule`, `projects`, `project_members`, `folders`,
`documents`, `document_versions`, `audit_logs` (partitioned), `project_templates`,
`template_folders` + phụ trợ: `releases`, `release_document_versions`, `user_project_preferences`.

## Điểm nhấn kỹ thuật được hiện thực ở tầng DB
- **Table Partitioning:** `audit_logs` `PARTITION BY RANGE (timestamp)`, sinh sẵn partition theo tháng `audit_logs_2026_01..12` + `audit_logs_default`. Hàm `create_audit_partition(year, month)` để mở partition tháng mới.
- **Hash Chaining (chống chối bỏ, FR-5.2):** trigger `compute_audit_hash` tự tính `current_hash = SHA256(previous_hash || nội dung dòng)`; sửa lén 1 dòng giữa chuỗi sẽ làm gãy hash phía sau.
- **Append-only (NFR-1.3):** trigger chặn mọi `UPDATE`/`DELETE` trên `audit_logs`.
- **gen_random_uuid()** cho khóa chính UUID (built-in PG13+).
- **pg_trgm** GIN index cho tìm kiếm mờ.

## Cách áp dụng

### A. Supabase (CLI)
```bash
supabase link --project-ref <your-ref>
supabase db push                       # áp dụng supabase/migrations/*
psql "$SUPABASE_DB_URL" -f supabase/optional/0005_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/optional/0006_supabase_auth_sync.sql   # nếu dùng Supabase Auth
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```
Hoặc dán nội dung từng file vào **SQL Editor** trên Dashboard, chạy đúng thứ tự.

### B. Docker local (tự động)
`docker compose up -d` sẽ tự chạy `0001→0004` + `seed.sql` khi khởi tạo `postgres` lần đầu
(qua `docker-entrypoint-initdb.d`). Các file `optional/` KHÔNG tự chạy (Supabase-only).

> Reset để chạy lại init: `docker compose down -v` rồi `docker compose up -d`.

## Prisma (NestJS Typed Client)
SQL ở đây là **source of truth**. Prisma chỉ dùng làm client gõ kiểu:
```bash
cd backend
npx prisma generate          # sinh client từ schema.prisma
# (tùy chọn) npx prisma db pull  # introspect lại từ DB nếu cần đồng bộ
```
`backend/prisma/schema.prisma` đã được map khớp tên bảng/cột snake_case, enum, và PK kép
`(id, timestamp)` của `audit_logs` để tương thích bảng partitioned.

## Tài khoản seed
- Email: `admin@viettel.com.vn`
- Mật khẩu: `Admin@123456` (băm bcrypt qua `pgcrypto`, tương thích xác thực bằng Node `bcrypt`)
