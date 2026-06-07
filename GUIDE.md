# VDT Zero-Trust DMS — Hướng dẫn vận hành & theo dõi hệ thống

> File này dành cho người **mới vào dự án**, chưa hiểu Docker đóng gói cái gì,
> không biết Redis/MinIO/Supabase làm việc thế nào, và muốn **tự bật/tắt/giám sát
> từng tài nguyên** qua các giao diện web có sẵn — không cần đoán mò.

---

## Mục lục
- [1. Hiểu kiến trúc tổng thể (5 phút)](#1-hiểu-kiến-trúc-tổng-thể-5-phút)
- [2. 7 thành phần đang chạy + Web UI riêng cho từng cái](#2-7-thành-phần-đang-chạy--web-ui-riêng-cho-từng-cái)
- [3. Setup từng service một (KHÔNG dùng `make up`)](#3-setup-từng-service-một-không-dùng-make-up)
- [4. Quản lý DỮ LIỆU — Supabase Cloud (PostgreSQL)](#4-quản-lý-dữ-liệu--supabase-cloud-postgresql)
- [5. Quản lý FILE — MinIO (S3-compatible)](#5-quản-lý-file--minio-s3-compatible)
- [6. Quản lý CACHE/QUEUE — Redis + BullMQ](#6-quản-lý-cachequeue--redis--bullmq)
- [7. Monitor realtime — Log + Network + DB queries](#7-monitor-realtime--log--network--db-queries)
- [8. Map "Click chuột trên UI → service nào xử lý"](#8-map-click-chuột-trên-ui--service-nào-xử-lý)
- [9. 12 lệnh debug thường dùng nhất](#9-12-lệnh-debug-thường-dùng-nhất)
- [10. Troubleshoot — 10 lỗi hay gặp](#10-troubleshoot--10-lỗi-hay-gặp)

---

## 1. Hiểu kiến trúc tổng thể (5 phút)

```
                          ┌─────────────────────────┐
                          │   TRÌNH DUYỆT (Chrome)  │
                          │   https://localhost     │
                          └────────────┬────────────┘
                                       │ HTTPS (TLS 1.3)
                                       ▼
                          ┌─────────────────────────┐
                          │   NGINX (vdt-nginx)     │  ← gateway, rate-limit, ép TLS
                          │   ports 80/443          │
                          └──┬───────────┬──────┬───┘
                  /          │           │      │  /vdt-docs/...
                 (SPA)       │  /api/v1/ │      │  (presigned URL)
                             ▼           ▼      ▼
        ┌────────────────┐ ┌──────────────────┐ ┌──────────────┐
        │  vdt-frontend  │ │     vdt-api      │ │  vdt-minio   │
        │  React SPA     │ │  NestJS REST API │ │  S3 storage  │
        │  (Vite build)  │ │  (ports 3000)    │ │  (ports 9000)│
        └────────────────┘ └────────┬─────────┘ └──────┬───────┘
                                    │                  │
            ┌───────────────────────┼──────────┐       │
            │                       │          │       │
            ▼                       ▼          ▼       │
        ┌────────┐         ┌────────────┐   ┌──────────────┐
        │SUPABASE│         │ vdt-redis  │   │ vdt-worker   │
        │PostgreSQL        │ session+   │   │ BullMQ jobs  │
        │(cloud)│          │ BullMQ+    │   │ (cùng image  │
        │managed│          │ cache      │   │  với api)    │
        └───────┘          └────────────┘   └──────┬───────┘
            ▲                                      │
            │                                      ▼
            │              ┌──────────────────────────────────┐
            └──────────────│ Worker pull job from Redis →    │
                           │ download file from MinIO →      │
                           │ extract/zip/scan → save raw_text │
                           │ → enqueue email                  │
                           └──────────────────────────────────┘

                           ┌──────────────────────────────────┐
                           │ vdt-diff-engine (Python FastAPI) │
                           │ port 8000 — so sánh 2 raw_text   │
                           └──────────────────────────────────┘
```

### Mỗi mũi tên = 1 protocol cụ thể:
| Từ → Đến | Protocol | Port | Để làm gì |
|---|---|---|---|
| Browser → Nginx | HTTPS | 443 | Mọi request từ trình duyệt |
| Nginx → Frontend | HTTP | 80 | Lấy HTML/JS/CSS React SPA |
| Nginx → Backend API | HTTP | 3000 | Forward `/api/v1/*` |
| Nginx → MinIO | HTTP | 9000 | Forward `/vdt-docs/*` (presigned URL) |
| Backend → Supabase | TLS Postgres | 6543 | Đọc/ghi DB qua Supavisor pooler |
| Backend → Redis | RESP | 6379 | Session, blacklist, cache, queue |
| Backend → MinIO | HTTP S3 API | 9000 (internal) | Upload/download file (SSE-S3) |
| Backend → Diff Engine | HTTP | 8000 | So sánh text v1 ↔ v2 |
| Worker → Redis (BLPOP) | RESP | 6379 | Lấy job từ queue |
| Worker → MinIO | HTTP S3 API | 9000 | Tải file để bóc text/zip |
| Worker → Supabase | TLS Postgres | 6543 | Cập nhật trạng thái xử lý |

> **Rule of thumb**: Mọi thứ "lưu trữ lâu dài" (text, file, audit log) ở **Supabase**.
> Mọi thứ "tạm thời / cần nhanh / queue" (token, lock, OTP, BullMQ job) ở **Redis**.
> Mọi thứ "file vật lý" (PDF, DOCX, raw_text) ở **MinIO**.

---

## 2. 7 thành phần đang chạy + Web UI riêng cho từng cái

| # | Container | Vai trò | Web UI để xem/quản lý | URL access |
|---|---|---|---|---|
| 1 | **vdt-nginx** | Reverse proxy + TLS | (không có GUI sẵn) | xem qua `docker logs` |
| 2 | **vdt-frontend** | React SPA tĩnh | trình duyệt | https://localhost/ |
| 3 | **vdt-api** | NestJS REST API | Swagger UI (nếu enable) | http://localhost:3000/api/v1 |
| 4 | **vdt-worker** | BullMQ job consumer | Bull-Board (cần install) | xem mục §6.3 |
| 5 | **vdt-minio** | S3 object storage | **MinIO Console** ✓ | http://localhost:9001 |
| 6 | **vdt-redis** | Cache + Queue + Session | **RedisInsight** (Redis Inc.) | xem mục §6.2 |
| 7 | **vdt-diff-engine** | Python diff microservice | FastAPI docs ✓ | http://localhost:8000/docs |
| **Cloud** | **Supabase** | PostgreSQL managed | **Supabase Dashboard** ✓ | https://supabase.com/dashboard/project/xfbrikkradopwjaoprrd |

**Bookmark 4 URL quan trọng nhất:**
1. `https://localhost/` — App chính (test luồng người dùng)
2. `http://localhost:9001` — **MinIO Console** (xem file, bucket, encryption)
3. `https://supabase.com/dashboard/project/xfbrikkradopwjaoprrd` — **Supabase Dashboard** (xem DB, audit log, SQL query)
4. `http://localhost:8000/docs` — **Diff Engine API docs** (FastAPI auto-gen)

---

## 3. Setup từng service một (KHÔNG dùng `make up`)

Khi bạn muốn hiểu rõ "service nào cần service nào, port nào nối port nào", thay vì `make up` (lên hết một lúc), bạn bật từng cái thủ công:

### Bước 0: Sinh certificate TLS (1 lần)
```bash
mkdir -p infra/nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/nginx/certs/tls.key \
  -out infra/nginx/certs/tls.crt \
  -subj "/C=VN/ST=Hanoi/L=Hanoi/O=Viettel/CN=dms.viettel.local" \
  -addext "subjectAltName=DNS:dms.viettel.local,DNS:localhost,IP:127.0.0.1"
```

### Bước 1: Bật Redis riêng (cần đầu tiên — backend phụ thuộc)
```bash
docker run -d --name vdt-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes --requirepass vdt_redis

# Test kết nối
docker exec vdt-redis redis-cli -a vdt_redis PING
# Kỳ vọng: PONG
```

### Bước 2: Bật MinIO riêng
```bash
docker run -d --name vdt-minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=vdt_minio \
  -e MINIO_ROOT_PASSWORD=vdt_minio_secret \
  -e MINIO_KMS_SECRET_KEY="vdt-demo-key:OMfWMJtx5cU4FJcy0o24wsIOVZ+tEHzxnNrryxoEe9Y=" \
  minio/minio:latest \
  server /data --console-address ":9001"

# Mở browser http://localhost:9001 → login (vdt_minio / vdt_minio_secret)
# Bạn sẽ thấy giao diện MinIO Console — chưa có bucket nào.

# Tạo bucket 'vdt-docs' + bật SSE-S3:
docker run --rm --network host minio/mc \
  sh -c "mc alias set local http://localhost:9000 vdt_minio vdt_minio_secret && \
         mc mb local/vdt-docs && \
         mc encrypt set sse-s3 local/vdt-docs"
```

### Bước 3: Bật Diff Engine (Python FastAPI)
```bash
docker run -d --name vdt-diff-engine \
  -p 8000:8000 \
  --network bridge \
  $(docker build -q ./diff-engine)  # build từ folder

# Verify FastAPI docs
curl http://localhost:8000/docs
# Hoặc mở browser http://localhost:8000/docs
```

### Bước 4: Đảm bảo Supabase còn sống (đã setup từ trước)
```bash
# Test connection từ Windows host (không cần Docker)
docker run --rm postgres:16-alpine psql "$DATABASE_URL" -c "SELECT count(*) FROM profiles;"
# Kỳ vọng: 5 (5 user Gmail đã seed)
```

### Bước 5: Bật Backend API (NestJS)
```bash
# Trên Windows + Git Bash:
MSYS_NO_PATHCONV=1 docker run -d --name vdt-api \
  --env-file "$(pwd)/.env" \
  --add-host=host.docker.internal:host-gateway \
  -p 3000:3000 \
  --link vdt-redis:redis \
  --link vdt-minio:minio \
  --link vdt-diff-engine:diff-engine \
  $(docker build -q ./backend) \
  node dist/main.js

# Hoặc cách an toàn hơn — dùng custom network:
docker network create vdt-net
docker network connect vdt-net vdt-redis
docker network connect vdt-net vdt-minio
docker network connect vdt-net vdt-diff-engine
# Rồi run backend với --network vdt-net thay --link

# Verify backend ready
docker logs vdt-api | grep "API đang chạy"
# Kỳ vọng: [VDT-DMS] API đang chạy tại http://localhost:3000/api/v1

# Test login (không cần Nginx, gọi thẳng port 3000)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"minhchoi2004@gmail.com","password":"Admin@123456"}'
```

### Bước 6: Bật Worker (cùng image với API)
```bash
MSYS_NO_PATHCONV=1 docker run -d --name vdt-worker \
  --env-file "$(pwd)/.env" \
  --network vdt-net \
  -e APP_ROLE=worker \
  vdt-api-image \
  node dist/workers/main.worker.js

# Verify worker ready
docker logs vdt-worker | grep "Worker đã khởi động"
```

### Bước 7: Bật Frontend
```bash
# Production build:
docker run -d --name vdt-frontend \
  --network vdt-net \
  --expose 80 \
  $(docker build -q ./frontend)

# HOẶC dev mode với hot reload:
MSYS_NO_PATHCONV=1 docker run -d --name vdt-frontend-dev \
  -p 5173:5173 \
  -e VITE_API_TARGET=http://host.docker.internal:3000 \
  --add-host=host.docker.internal:host-gateway \
  -v "$(pwd)/frontend":/app -w /app \
  node:20-alpine \
  npm run dev -- --host 0.0.0.0
# Mở http://localhost:5173/
```

### Bước 8: Bật Nginx cuối cùng (cần frontend + backend ready)
```bash
docker run -d --name vdt-nginx \
  --network vdt-net \
  -p 80:80 -p 443:443 \
  -v "$(pwd)/infra/nginx/nginx.conf":/etc/nginx/nginx.conf:ro \
  -v "$(pwd)/infra/nginx/certs":/etc/nginx/certs:ro \
  nginx:1.27-alpine

# Verify HTTPS
curl -sk https://localhost/healthz
# Kỳ vọng: ok
```

> **Tip**: Khi setup từng bước thế này, bạn sẽ thấy rõ thứ tự phụ thuộc:
> Redis → MinIO → Supabase (cloud) → Backend → Worker → Frontend → Nginx.
> Đó cũng là thứ tự `depends_on` trong `docker-compose.yml`.

---

## 4. Quản lý DỮ LIỆU — Supabase Cloud (PostgreSQL)

### 4.1 Vai trò
- Lưu **tất cả dữ liệu cấu trúc lâu dài**: users, projects, documents, audit_logs.
- 13 bảng chính + 12 partition `audit_logs_2026_*` + 3 trigger Hash Chaining.
- **Source of truth** — nếu mất MinIO/Redis có thể restore, nhưng mất Supabase = mất hết.

### 4.2 Web Dashboard chính thức
🔗 **https://supabase.com/dashboard/project/xfbrikkradopwjaoprrd**

Đăng nhập tài khoản Supabase. Bạn sẽ thấy 5 tab quan trọng:

| Tab | Để làm gì |
|---|---|
| **Table Editor** | Xem 13 bảng như Excel. Click `profiles` → thấy 5 user. Sửa trực tiếp được. |
| **SQL Editor** | Gõ SQL query tự do. Ví dụ: `SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50;` |
| **Database → Tables** | Schema designer, foreign key visualizer, indexes |
| **Database → Logs** | DB query log — thấy mỗi query backend gửi lên, kèm response time |
| **Settings → Database** | Connection string, reset password, pooler config |

### 4.3 SQL Query thường dùng

Mở **SQL Editor** trên Supabase Dashboard, paste và Run:

```sql
-- Xem 5 user demo
SELECT email, full_name, title, clearance_level, status FROM profiles;

-- Xem 50 audit log gần nhất (Hash Chaining)
SELECT id, action, user_id, ip_address, is_success,
       LEFT(current_hash, 12) AS hash_prefix
FROM audit_logs ORDER BY id DESC LIMIT 50;

-- Đếm document theo project
SELECT p.name, COUNT(d.id) AS doc_count
FROM projects p LEFT JOIN documents d ON d.project_id = p.id
GROUP BY p.name;

-- Xem Casbin policy rules
SELECT ptype, v0, v1, v2 FROM casbin_rule LIMIT 20;

-- Kiểm tra trigger Hash Chain còn hoạt động không (tự verify 10 row đầu)
SELECT id, encode(digest(
  COALESCE(previous_hash, '') || user_id::text || action || COALESCE(target_id, '') ||
  COALESCE(ip_address, '') || timestamp::text || is_success::text,
  'sha256'
), 'hex') = current_hash AS hash_valid
FROM audit_logs ORDER BY id LIMIT 10;
```

### 4.4 Kết nối qua client desktop (thay thế Dashboard)

Nếu muốn dùng **DBeaver / TablePlus / pgAdmin** trên máy local:

```
Host:     aws-1-ap-south-1.pooler.supabase.com
Port:     5432  (session pooler — cho phép DDL)
Database: postgres
User:     postgres.xfbrikkradopwjaoprrd
Password: V6D06Y5NjXE27SVH
SSL:      Required
```

### 4.5 Prisma Studio (GUI cho dev)

Nếu muốn xem data qua giao diện đẹp + filter Prisma:

```bash
cd backend
npx prisma studio
# Mở http://localhost:5555 — UI tương tự Airtable
```

Prisma Studio tự dùng `DATABASE_URL` trong `.env`. Mọi sửa đổi đẩy thẳng Supabase.

### 4.6 Bootstrap schema lại từ đầu (nếu lỡ DROP nhầm)

```bash
# Trong terminal Git Bash, từ root project:
make db-bootstrap

# Tương đương:
docker run --rm -v "$(pwd)/supabase":/sql postgres:16-alpine sh -c "
  psql \"$DIRECT_URL\" -f /sql/migrations/0001_init_schema.sql && \
  psql \"$DIRECT_URL\" -f /sql/migrations/0002_audit_integrity.sql && \
  psql \"$DIRECT_URL\" -f /sql/migrations/0003_triggers_updated_at.sql && \
  psql \"$DIRECT_URL\" -f /sql/migrations/0004_search_indexes.sql && \
  psql \"$DIRECT_URL\" -f /sql/seed.sql"
```

---

## 5. Quản lý FILE — MinIO (S3-compatible)

### 5.1 Vai trò
- Lưu **file vật lý**: PDF, DOCX, MD, TXT tài liệu user upload.
- Mỗi version document có 1 `storage_key` (path trong bucket) + optional `raw_text_storage_key`.
- **Mã hóa ở phía server bằng AES-256 (SSE-S3)** — file nằm trên disk MinIO là binary đã mã hóa, không đọc được nếu copy ra ngoài.

### 5.2 Web Console (giao diện chính thức của MinIO)
🔗 **http://localhost:9001**

Login:
- Username: `vdt_minio`
- Password: `vdt_minio_secret`

Bạn sẽ thấy:
- **Object Browser**: xem cây folder + file trong bucket `vdt-docs`. Click vào 1 file → xem metadata + tải về.
- **Buckets**: tạo/xóa bucket, bật/tắt versioning, encryption, lifecycle policy.
- **Identity → Users**: quản lý IAM user (giống AWS IAM).
- **Monitoring → Metrics**: dung lượng, số request, traffic chart.
- **Tools → Speedtest**: benchmark upload/download.
- **License**: AGPL v3 (open source, free for self-host).

### 5.3 Cấu trúc folder trong bucket `vdt-docs`

```
vdt-docs/
└── projects/
    └── <projectId>/
        └── <documentId>/
            ├── v1_filename.pdf          ← original file (encrypted)
            ├── v1_filename.pdf.txt      ← raw_text extracted by worker
            ├── v2_filename.pdf
            └── v2_filename.pdf.txt
```

Bạn có thể click vào MinIO Console → vdt-docs → projects/... → thấy y chang structure trên.

### 5.4 CLI quản lý qua `mc` (MinIO Client)

```bash
# Setup alias (1 lần đầu)
docker run --rm --network host minio/mc \
  alias set local http://localhost:9000 vdt_minio vdt_minio_secret

# List buckets
docker run --rm --network host minio/mc ls local/

# List file trong bucket
docker run --rm --network host minio/mc ls local/vdt-docs/projects/ --recursive

# Xem dung lượng bucket
docker run --rm --network host minio/mc du local/vdt-docs/

# Tải 1 file về local
docker run --rm --network host -v "$(pwd)/tmp":/tmp minio/mc \
  cp local/vdt-docs/projects/xxx/v1_file.pdf /tmp/

# Verify encryption bật trên bucket
docker run --rm --network host minio/mc encrypt info local/vdt-docs
# Kỳ vọng: "Auto encryption 'sse-s3' is enabled"
```

### 5.5 Hiểu Presigned URL (cách browser tải file mà KHÔNG có credentials)

Khi browser xin tải v1.pdf:
1. **Browser** → `GET /api/v1/documents/<docId>/versions/<vid>/download`
2. **Backend** → check ABAC clearance. Nếu OK, gọi MinIO SDK gen URL có chữ ký SigV4 hết hạn 5 phút.
3. **Backend → Browser**: trả `{ "downloadUrl": "https://localhost/vdt-docs/...?X-Amz-Signature=..." }`
4. **Browser** → `GET https://localhost/vdt-docs/...?X-Amz-Signature=...` (qua Nginx)
5. **Nginx** → proxy thẳng đến MinIO (location `^/(vdt-docs)/`).
6. **MinIO** verify SigV4 (đảm bảo URL chưa hết hạn + chưa sửa) → trả file binary.

Lý do tại sao **không bao giờ commit MinIO credentials vào frontend**: nếu backend trả MinIO password thẳng browser thì user lấy được key → tải file người khác. Presigned URL chỉ cho phép GET đúng 1 file, hết hạn nhanh.

### 5.6 Verify SSE-S3 thực sự đang mã hóa

```bash
# Upload thử 1 file bất kỳ qua API:
curl -kX POST https://localhost/api/v1/projects/<pid>/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./test.txt" \
  -F "title=Test" \
  -F "commitMessage=Test encrypt"

# Xem metadata file vừa upload:
docker run --rm --network host minio/mc stat local/vdt-docs/projects/xxx/v1_test.txt
# Kỳ vọng dòng: "Encryption: sse-s3 (AES256)"

# Thử cat raw file binary trên disk MinIO:
docker exec vdt-minio cat /data/vdt-docs/projects/.../v1_test.txt | head -c 100
# Kỳ vọng: binary garbled (đã mã hóa) — KHÔNG đọc được nội dung gốc
```

---

## 6. Quản lý CACHE/QUEUE — Redis + BullMQ

### 6.1 Vai trò chi tiết của Redis trong hệ thống

Redis là **đa nhiệm**: cùng 1 instance phục vụ **8 nhiệm vụ khác nhau**, được phân biệt qua key prefix:

| Key prefix | Mục đích | TTL |
|---|---|---|
| `session:<userId>:<jti>` | Refresh token sessions | 7 ngày |
| `blacklist:<jti>` | JWT bị thu hồi (logout) | 15 phút |
| `otp:register:<email>` | OTP đăng ký | 5 phút |
| `otp:forgot:<email>` | OTP quên mật khẩu | 5 phút |
| `otp:profile:<userId>` | OTP gate sửa hồ sơ | 5 phút |
| `abac:cache:<userId>` | Casbin permission cache | 5 phút |
| `doc:lock:<docId>` | Pessimistic lock tài liệu | 2 giờ |
| `user:download_freq:<userId>` (ZSET) | Anomaly Detection rate | sliding 1 phút |
| `system:lockdown` | Emergency Lockdown flag | manual |
| `release:export:<releaseId>` | URL file zip export | 1 giờ |
| `bull:*` | BullMQ jobs + queues | varies |

### 6.2 RedisInsight — GUI chính thức của Redis Inc.

**Cài** (free, không cần signup):
```bash
docker run -d --name redis-insight \
  -p 5540:5540 \
  redis/redisinsight:latest

# Mở browser: http://localhost:5540
```

Trong RedisInsight → "Add Database":
- **Host**: `host.docker.internal` (vì RedisInsight chạy trong container, cần truy cập host)
- **Port**: `6379`
- **Username**: (để trống)
- **Password**: `vdt_redis`
- **Name**: VDT DMS Redis

Sau khi add, bạn có:
- **Browser**: cây hierarchical view các key (phân nhóm theo prefix). Click `session:` → thấy tất cả session đang active.
- **Workbench**: gõ Redis command tự do. Ví dụ:
  ```
  KEYS *
  KEYS otp:*
  GET otp:register:test@gmail.com
  ZRANGE user:download_freq:abc-123 0 -1 WITHSCORES
  ```
- **Profiler**: realtime command tail (`MONITOR`) — thấy mọi backend làm gì với Redis từng giây.
- **Slowlog**: query chậm > 10ms.
- **Stream**: nếu dùng Redis Streams (chưa dùng).

### 6.3 BullMQ Board — GUI cho 4 queue background jobs

Hệ thống có 4 queue chạy ngầm:

| Queue | Vai trò | Triggered khi |
|---|---|---|
| `text-extraction` | Bóc text từ PDF/DOCX/MD/TXT | Upload tài liệu < 15MB |
| `mailer` | Gửi email OTP, kết quả review | Register, Approve, Reject |
| `release-export` | Nén zip release package | Bấm "Export Release" |
| `integrity-scan` | Verify Hash Chain audit_logs | Bấm "Quét toàn bộ" ở Tamper Hub |

**Cài Bull-Board** (UI giám sát BullMQ):

```bash
# Cài npm package + chạy server riêng (chỉ dev — không deploy production)
mkdir bull-board && cd bull-board
npm init -y
npm install @bull-board/express @bull-board/api express bullmq

cat > server.js <<'EOF'
const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');

const redisOpts = {
  host: 'localhost',
  port: 6379,
  password: 'vdt_redis',
};

const queues = [
  new Queue('text-extraction', { connection: redisOpts }),
  new Queue('mailer', { connection: redisOpts }),
  new Queue('release-export', { connection: redisOpts }),
  new Queue('integrity-scan', { connection: redisOpts }),
];

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/');
createBullBoard({
  queues: queues.map(q => new BullMQAdapter(q)),
  serverAdapter,
});

const app = express();
app.use('/', serverAdapter.getRouter());
app.listen(3001, () => console.log('Bull-Board http://localhost:3001'));
EOF

node server.js
```

Mở **http://localhost:3001** — thấy 4 queue với:
- Job đang chờ (waiting), đang chạy (active), đã xong (completed), thất bại (failed)
- Click job → xem payload, log, error stack trace
- Có thể retry / cancel / clean job

### 6.4 Lệnh redis-cli nhanh

```bash
# Vào shell Redis trong container
docker exec -it vdt-redis redis-cli -a vdt_redis

# Trong prompt redis-cli (127.0.0.1:6379>):
KEYS otp:*                          # tất cả OTP đang chờ
GET otp:register:test@gmail.com     # xem OTP cụ thể
TTL session:abc-uuid:xxx-jti        # còn sống bao lâu
ZRANGE user:download_freq:user-uuid 0 -1 WITHSCORES   # download history 1 user
INFO clients                        # số client đang connect
INFO memory                         # RAM sử dụng
MONITOR                             # tail mọi command realtime (Ctrl-C để thoát)
FLUSHDB                             # XÓA HẾT — chỉ dùng khi test
exit
```

---

## 7. Monitor realtime — Log + Network + DB queries

### 7.1 Tail log backend khi user click chuột

```bash
# Terminal 1: tail log backend
docker logs -f vdt-api

# Terminal 2: tail log worker
docker logs -f vdt-worker

# Terminal 3: tail log Nginx (xem request đến)
docker logs -f vdt-nginx

# Terminal 4: tail log MinIO (xem GetObject/PutObject)
docker logs -f vdt-minio
```

Khi user click "Đăng nhập" trên https://localhost, bạn sẽ thấy:
- **Nginx**: `POST /api/v1/auth/login HTTP/2.0 200 ...`
- **Backend**: log Casbin enforce + audit ghi DB

### 7.2 Network inspector (xem request HTTP từ browser)

Mở Chrome DevTools (F12) → tab **Network** → check "Preserve log". Mỗi click sẽ thấy:
- Method (GET/POST/PATCH)
- URL endpoint
- Status code
- Time (TTFB + Download)
- Request/Response headers, body, cookies

### 7.3 Supabase Logs — xem mọi query DB realtime

🔗 **Dashboard → Database → Logs**

Bạn thấy:
- Mỗi SQL query từ backend (kèm execution time)
- Connection pool stats
- Slowest queries

Filter: `SELECT * FROM profiles` → check xem có query thừa không (N+1 problem).

### 7.4 Docker Desktop GUI

Mở Docker Desktop (đã install sẵn trên Windows):
- Tab **Containers**: 7 vdt-* containers với CPU/RAM realtime
- Click container → tab **Logs** (tail), **Inspect** (config), **Files** (FS browser), **Exec** (shell vào container)
- Tab **Volumes**: dữ liệu persist của Redis + MinIO

### 7.5 Stack monitoring với `docker stats`

```bash
docker stats vdt-api vdt-worker vdt-redis vdt-minio vdt-nginx vdt-frontend vdt-diff-engine
```

Hiển thị bảng realtime: CPU%, MEM usage, NET I/O, BLOCK I/O cho từng container. Tốt để phát hiện service ăn CPU vô lý.

### 7.6 Realtime BullMQ qua Bull-Board (mục §6.3)

Khi user upload file → tab `text-extraction` của Bull-Board sẽ có job mới chạy → thấy số job waiting/active/completed thay đổi realtime.

---

## 8. Map "Click chuột trên UI → service nào xử lý"

Để hiểu hệ thống làm việc, bạn cần biết **mỗi action UI chạy qua bao nhiêu service**:

### Click "Đăng nhập"
```
Browser → Nginx (HTTPS) → Backend → Supabase (check email+password)
                                  → Redis (lưu session + lưu rate-limit)
                                  → Supabase (INSERT audit_logs với Hash Chain trigger)
                                  → trả JWT về browser
```

### Click "Upload tài liệu"
```
Browser → Nginx → Backend (multer parse multipart) → MinIO (PutObject + SSE-S3)
                                                   → Supabase (INSERT documents + document_versions)
                                                   → Redis (enqueue 'text-extraction' job)
                                                   → trả documentId + versionId

Worker (background) ← Redis BLPOP 'text-extraction'
                    → MinIO (download file)
                    → pdf-parse / mammoth bóc text
                    → MinIO (PutObject raw_text)
                    → Supabase (UPDATE document_versions.text_extracted = true)
```

### Click "Tải file" (Document Detail → Download)
```
Browser → Nginx → Backend → Supabase (check security_level, project_member)
                          → Redis (ZADD user:download_freq + ZCARD anomaly check)
                          → MinIO publicS3 SDK (gen presigned URL với SigV4)
                          → trả {downloadUrl} về browser
Browser → Nginx (location /vdt-docs/) → MinIO (verify SigV4 + stream file)
```

### Click "Phê duyệt tài liệu"
```
Browser → Nginx → Backend → Supabase (FSM transition UNDER_REVIEW → RELEASED)
                          → Supabase (set documents.published_version_id)
                          → Redis (DEL doc:lock:* vì done editing)
                          → Redis (enqueue 'mailer' job → notify author)
                          → Supabase (INSERT audit_logs WORKFLOW_DECISION)

Worker → Redis BLPOP 'mailer' → Nodemailer → SMTP server (hoặc log DEV-MAIL)
```

### Click "So sánh 2 version"
```
Browser → Nginx → Backend → Supabase (check 2 version cùng document)
                          → MinIO internal SDK (gen presigned URL raw_text v1 + v2)
                          → HTTP POST → Diff Engine (FastAPI)
                          → Diff Engine: download 2 raw_text, run difflib.SequenceMatcher
                          → trả deltas + originalUrls về Backend
                          → Backend trả về Browser
```

### Click "Quét toàn bộ" (Tamper Hub)
```
Browser → Nginx → Backend → Redis (enqueue 'integrity-scan' job)
                          → trả jobId + trạng thái PENDING

Worker → Redis BLPOP 'integrity-scan'
       → Supabase (Keyset pagination 1000 audit_logs/lô)
       → SHA-256 từng row với stored previous_hash
       → nếu mismatch → INSERT audit_logs 'SECURITY_ALERT'
       → kết thúc → set Redis 'system:scan-result' = SECURE/COMPROMISED

Browser polling → Backend → Redis GET 'system:scan-result'
```

---

## 9. 12 lệnh debug thường dùng nhất

```bash
# 1. Trạng thái tất cả 7 container
docker compose ps

# 2. Log realtime của 1 service
docker logs -f vdt-api               # Backend NestJS
docker logs -f vdt-worker            # BullMQ Worker
docker logs -f vdt-nginx             # Nginx access + error log

# 3. Vào shell container
docker exec -it vdt-api sh           # Bash trong container backend
docker exec -it vdt-redis redis-cli -a vdt_redis     # Redis CLI

# 4. Restart 1 service
docker restart vdt-api               # KHÔNG reload env file
docker compose up -d --force-recreate vdt-api        # RELOAD env file

# 5. Verify Supabase còn sống
docker run --rm postgres:16-alpine psql "$DATABASE_URL" -c "SELECT 1;"

# 6. Verify Redis còn sống
docker exec vdt-redis redis-cli -a vdt_redis PING

# 7. Verify MinIO còn sống
curl http://localhost:9000/minio/health/live

# 8. Smoke-test toàn stack qua Nginx
curl -sk https://localhost/healthz
curl -sk -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"minhchoi2004@gmail.com","password":"Admin@123456"}'

# 9. Xem CPU/RAM realtime
docker stats

# 10. Xem network connection của container
docker network inspect websec_default

# 11. Xem disk usage volume
docker system df -v

# 12. Dump database (backup nhanh)
docker run --rm postgres:16-alpine pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

---

## 10. Troubleshoot — 10 lỗi hay gặp

### 1. `Cannot connect to Redis` khi start backend
**Nguyên nhân**: Redis chưa lên hoặc password sai.
```bash
docker exec vdt-redis redis-cli -a vdt_redis PING       # phải trả PONG
docker logs vdt-redis | tail                            # xem có lỗi gì không
# Verify .env: REDIS_URL=redis://:vdt_redis@redis:6379
```

### 2. `password authentication failed for user` khi backend kết nối Supabase
**Nguyên nhân**: `.env` sai password Supabase, hoặc dùng `aws-0` thay vì `aws-1`.
```bash
# Test ngoài backend
docker run --rm postgres:16-alpine psql "$DATABASE_URL" -c "SELECT 1;"
# Nếu fail: vào Supabase Dashboard → Database → Reset password → cập nhật .env
docker compose up -d --force-recreate backend worker    # PHẢI force-recreate
```

### 3. `SignatureDoesNotMatch` khi browser tải file qua /vdt-docs/
**Nguyên nhân**: `MINIO_PUBLIC_ENDPOINT` mismatch giữa lúc backend ký URL và Nginx forward.
```
PROD (compose): MINIO_PUBLIC_ENDPOINT=https://localhost
DEV (manual):   MINIO_PUBLIC_ENDPOINT=http://localhost:9000
```
Sau khi sửa `.env`: `docker compose up -d --force-recreate backend worker`.

### 4. `docker restart vdt-api` không nạp `.env` mới
**Đây là behavior của Docker**: `restart` chỉ start lại process, KHÔNG đọc lại `--env-file`.
Phải dùng `docker compose up -d --force-recreate backend` (tạo container mới).

### 5. Nginx báo `SSL_CTX_set_cipher_list failed` lặp restart loop
**Nguyên nhân**: `ssl_ciphers` directive không tương thích TLS 1.3-only cipher names.
**Fix**: Đã bỏ `ssl_ciphers` line trong `infra/nginx/nginx.conf`.

### 6. `Vite HMR không bắt file change trên Windows`
**Nguyên nhân**: Bind mount Windows → Linux container thường miss file events.
**Workaround**: `docker restart vdt-frontend-dev` sau khi sửa file.

### 7. `Cannot find module './app/router'` khi `docker compose build`
**Nguyên nhân**: Linux case-sensitive, file là `Router.tsx` nhưng import lowercase.
**Fix**: Sửa `import { AppRouter } from './app/Router'` (Capital R).

### 8. Upload file 0 byte vào MinIO
**Nguyên nhân**: `.env` có inline comment sau `MAX_UPLOAD_BYTES` → `Number()` ra NaN → multer truncate.
**Fix**: KHÔNG đặt `# comment` sau giá trị số. Comment phải ở dòng riêng phía trên.

### 9. Frontend chạy nhưng `/api/...` trả 404
**Nguyên nhân**: Vite dev proxy chưa cấu hình hoặc backend chưa lên.
**Fix**: Kiểm tra `frontend/vite.config.ts` có `proxy: { '/api': { target: ... } }` không. Hoặc đặt `VITE_API_TARGET=http://host.docker.internal:3000` trong env của Vite container.

### 10. Audit log không ghi (Hash Chain bị skip)
**Nguyên nhân**: User đang ở session đã expire JWT hoặc backend không thấy interceptor `AuditHashInterceptor`.
**Verify**:
```sql
-- Trên Supabase SQL Editor
SELECT COUNT(*), MAX(timestamp) FROM audit_logs;
-- Nếu count không tăng sau khi click → check trigger có exist không:
SELECT tgname FROM pg_trigger WHERE tgrelid='audit_logs'::regclass;
-- Phải có: trg_audit_hash, trg_audit_no_update, trg_audit_no_delete
```

---

## Phụ lục — Bookmark nhanh

| Bạn muốn... | Mở URL |
|---|---|
| Test app người dùng | https://localhost/ |
| Login admin | `minhchoi2004@gmail.com` / `Admin@123456` |
| Quản lý file (S3) | http://localhost:9001 |
| Quản lý DB (cloud) | https://supabase.com/dashboard/project/xfbrikkradopwjaoprrd |
| Test API Swagger Diff | http://localhost:8000/docs |
| GUI Redis (sau khi cài) | http://localhost:5540 |
| GUI BullMQ (sau khi cài) | http://localhost:3001 |
| Prisma Studio (dev DB GUI) | `cd backend && npx prisma studio` → http://localhost:5555 |

---

_Cập nhật: 2026-05-28. Tài liệu sống — sửa khi infra thay đổi._
