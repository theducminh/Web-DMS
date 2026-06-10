# VDT Zero-Trust DMS — Development Guide

Tài liệu hướng dẫn dev hot-reload cho từng phần của stack. Bổ sung cho [docs/WSL2_SETUP.md](docs/WSL2_SETUP.md) (setup máy lần đầu) và [GUIDE.md](GUIDE.md) (deploy production).

> **Tiền đề:** Code đã clone về `~/vdt-dms/` (Linux ext4), Docker Desktop tích hợp WSL2 đã bật. Nếu chưa: đọc [docs/WSL2_SETUP.md](docs/WSL2_SETUP.md).

---

## 📌 2 chế độ chạy stack

| Chế độ | Script | Hot reload? | Dùng khi nào? |
|---|---|---|---|
| **Production** | `./scripts/prod-up.sh` | ❌ Phải `--build` lại khi đổi code | Demo cho mentor, deploy lên server, test end-to-end qua Nginx HTTPS |
| **Development** | `./scripts/dev-up.sh` | ✅ Sửa file → tự rebuild + restart | Dev hàng ngày |

> Toàn bộ workflow đi qua bộ **scripts/** ở root project. Không cần nhớ lệnh dài, không phụ thuộc alias cá nhân. Xem [scripts/README.md](scripts/README.md) cho tham chiếu đầy đủ.

### Lần đầu setup máy (sau khi clone)

```bash
cd ~/vdt-dms
./scripts/install.sh           # Verify Docker + tạo .env + chmod scripts + pull image base
nano .env                       # Điền DATABASE_URL, SMTP, OAuth, JWT_SECRET
./scripts/dev-up.sh             # Khởi động stack dev
./scripts/status.sh             # Verify 7 endpoint
```

### Workflow hằng ngày

```bash
./scripts/dev-up.sh             # Sáng up stack
./scripts/dev-logs.sh backend    # Tab khác tail log
# Code trong VSCode WSL Remote -> sửa .ts/.tsx -> auto reload
./scripts/dev-down.sh           # Cuối ngày
```

### Không muốn dùng script, chạy lệnh thuần?
Mọi script chỉ là wrapper mỏng của `docker compose`. Xem [scripts/README.md](scripts/README.md) và phần "🧱 Lệnh thuần" ở cuối file này.

---

## 🧩 Dev từng phần

### 1. Dev BACKEND (NestJS) hot-reload

```bash
# Khởi động lần đầu (cài deps + prisma generate + start:dev)
./scripts/dev-up.sh backend

# Xem log realtime
./scripts/dev-logs.sh backend

# Sửa file backend/src/**/*.ts → NestJS tự build + restart trong ~2-5s
# Log sẽ in: "Watching for file changes..." → "Found N changed files" → restart
```

**Debug breakpoint trong VSCode:**
1. Chạy `./scripts/dev-debug.sh` — script này override command backend để bật Node Inspector ở `0.0.0.0:9229`.
2. Tạo `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to NestJS in Docker",
      "address": "localhost",
      "port": 9229,
      "localRoot": "${workspaceFolder}/backend",
      "remoteRoot": "/app",
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```
3. F5 trong VSCode → đặt breakpoint trong file `.ts` → gọi API → dừng tại breakpoint.

**Khi cần install package mới:**
```bash
./scripts/dev-exec.sh backend npm install <package-name>
# Hoặc edit package.json từ host → restart container
./scripts/dev-restart.sh backend
```

**Khi cần migrate Prisma:**
```bash
./scripts/dev-exec.sh backend npx prisma migrate dev --name <ten-migration>
# Hoặc deploy migrations sẵn có:
./scripts/dev-exec.sh backend npx prisma migrate deploy
# Reset DB (cẩn thận, xóa hết data):
./scripts/dev-exec.sh backend npx prisma migrate reset
```

---

### 2. Dev WORKER (BullMQ processor)

Worker dùng `nodemon` watch `dist/` — tức là khi backend container build xong (vì backend container và worker container share source `./backend`), worker tự pick up changes.

```bash
./scripts/dev-up.sh worker
./scripts/dev-logs.sh worker

# Khi muốn test job thủ công:
./scripts/dev-exec.sh redis redis-cli -a vdt_redis
# Trong redis-cli: KEYS "bull:*"  để xem queue
```

> ⚠️ Worker phụ thuộc `dist/` được nest build. Nếu thấy worker không restart sau khi sửa code: kiểm tra log `backend` xem build đã xong chưa. Có 2-3s lag giữa "backend rebuilt" và "worker restarted".

---

### 3. Dev FRONTEND (Vite HMR)

```bash
./scripts/dev-up.sh frontend
./scripts/dev-logs.sh frontend

# Truy cập trực tiếp Vite dev server:
# 👉 http://localhost:5173/   (KHÔNG phải https://localhost/)
```

**Vite HMR:**
- Sửa `.tsx` → cập nhật instant (~100ms), state component KHÔNG mất
- Sửa `.css` (Tailwind) → reload instant không nháy
- Sửa `vite.config.ts` hoặc `package.json` → cần `./scripts/dev-restart.sh frontend`

**Khi cần install package mới:**
```bash
./scripts/dev-exec.sh frontend npm install <package-name>
./scripts/dev-restart.sh frontend
```

**Khi muốn test build production qua nginx:**
```bash
./scripts/dev-down.sh                  # Tắt dev
./scripts/prod-up.sh --build           # Build bundle minified + Nginx HTTPS
# Truy cập https://localhost/
```

---

### 4. Dev DIFF-ENGINE (FastAPI)

```bash
./scripts/dev-up.sh diff-engine
./scripts/dev-logs.sh diff-engine

# Sửa diff-engine/main.py → uvicorn --reload tự pick up trong ~1s
# Test endpoint:
curl http://localhost:8000/health
curl -X POST http://localhost:8000/diff -H "Content-Type: application/json" -d '{"left":"hello world","right":"hello duc"}'
```

---

### 5. Dev INFRA (Nginx / Prometheus / Grafana)

**Nginx config** (`infra/nginx/nginx.conf`):
- Sửa file → KHÔNG cần rebuild image (file là `:ro` mount).
- Reload Nginx:
  ```bash
  ./scripts/dev-exec.sh nginx nginx -s reload
  ```

**Prometheus targets** (`infra/prometheus/prometheus.yml`, `alerts.yml`):
- Sửa file → reload qua Lifecycle API:
  ```bash
  curl -X POST http://localhost:9090/-/reload
  ```
- Hoặc restart:
  ```bash
  ./scripts/dev-restart.sh prometheus
  ```

**Grafana dashboard** (`infra/grafana/dashboards/*.json`):
- Mount với `updateIntervalSeconds: 10` → Grafana tự reload dashboard mới mỗi 10s.
- Nếu thêm datasource mới: phải `./scripts/dev-restart.sh grafana` (provisioning chỉ chạy lần init).
- Edit dashboard trong UI → bấm `Share → Export → Save to file` → ghi đè JSON trong `infra/grafana/dashboards/`.

---

## 🔍 Verify nhanh sau khi up

```bash
# Status tổng quan + curl 7 endpoint
./scripts/status.sh

# Hoặc verify tay từng URL
curl http://localhost:3000/api/v1/metrics | head      # Backend metrics
curl -I http://localhost:5173/                         # Frontend Vite
curl -s 'http://localhost:9090/api/v1/targets' | head  # Prometheus targets
```

---

## 🛑 Stop / Reset

```bash
# Dừng nhưng giữ data
./scripts/dev-down.sh

# Dừng + xóa volume (CẨN THẬN — xóa Redis/MinIO/Prometheus data, KHÔNG ảnh hưởng Supabase cloud)
./scripts/dev-down.sh -v

# Restart 1 service
./scripts/dev-restart.sh backend

# Rebuild 1 service từ Dockerfile (khi đổi Dockerfile)
./scripts/dev-rebuild.sh backend

# Reset hoàn toàn (down -v + prune image dangling)
./scripts/reset.sh
```

---

## 🐛 Debug pattern

### Backend trả lỗi nhưng log không thấy gì
```bash
# Bật log level debug trong .env
LOG_LEVEL=debug

# Restart backend
./scripts/dev-restart.sh backend
./scripts/dev-logs.sh backend
```

### Frontend không gọi được backend (CORS / network)
```bash
# Kiểm tra Vite proxy/env
cat frontend/.env.development 2>/dev/null
# Verify VITE_API_BASE_URL trỏ đúng:
# - Dev (qua nginx ko cần): VITE_API_BASE_URL=/api/v1
# - Dev (bypass nginx): VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### Prisma báo "schema drift"
```bash
./scripts/dev-exec.sh backend npx prisma migrate status

# Nếu cần đồng bộ với schema cloud Supabase:
./scripts/dev-exec.sh backend npx prisma db pull
./scripts/dev-exec.sh backend npx prisma generate
```

### Redis kẹt key cũ làm logic sai
```bash
./scripts/dev-exec.sh redis redis-cli -a vdt_redis FLUSHDB
# (chỉ DB hiện tại, không xóa data persistent file)
```

### Xem stack trace đầy đủ khi NestJS crash boot
```bash
./scripts/dev-exec.sh backend node --enable-source-maps dist/main.js
```

---

## 📊 Monitoring khi dev

Bật stack monitoring (Prometheus + Grafana):
```bash
./scripts/dev-up.sh prometheus grafana node-exporter cadvisor redis-exporter
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin / Admin@123456)
- Backend metrics endpoint: http://localhost:3000/api/v1/metrics

Khi sửa Prometheus alert rules:
```bash
# Verify config syntax trước khi reload
./scripts/dev-exec.sh prometheus promtool check config /etc/prometheus/prometheus.yml
./scripts/dev-exec.sh prometheus promtool check rules /etc/prometheus/alerts.yml

# Reload nóng (không downtime)
curl -X POST http://localhost:9090/-/reload
```

---

## 🧱 Lệnh thuần `docker compose` (khi không dùng script)

Toàn bộ script chỉ wrap 2 lệnh prefix:
- Dev: `docker compose -f docker-compose.yml -f docker-compose.dev.yaml ...`
- Prod: `docker compose -f docker-compose.yml ...`

Bảng tra cứu nhanh:

| Việc | Script | Lệnh thuần |
|---|---|---|
| Up stack dev | `./scripts/dev-up.sh` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml up -d` |
| Down stack dev | `./scripts/dev-down.sh` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml down` |
| Log backend | `./scripts/dev-logs.sh backend` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml logs -f --tail=200 backend` |
| Restart backend | `./scripts/dev-restart.sh backend` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml restart backend` |
| Shell backend | `./scripts/dev-shell.sh backend` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml exec backend sh` |
| Exec lệnh trong backend | `./scripts/dev-exec.sh backend <cmd>` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml exec backend <cmd>` |
| Rebuild image backend | `./scripts/dev-rebuild.sh backend` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml up -d --build backend` |
| Up stack prod | `./scripts/prod-up.sh` | `docker compose -f docker-compose.yml up -d` |
| Status | `./scripts/status.sh` | `docker compose -f docker-compose.yml -f docker-compose.dev.yaml ps` |
| Reset all | `./scripts/reset.sh` | `docker compose -f ... down -v --remove-orphans && docker image prune -f` |

Để tránh gõ prefix dài, có 2 cách rút gọn KHÔNG cần script:

**Cách A — Export biến môi trường (mỗi session terminal):**
```bash
export COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yaml
docker compose up -d           # Docker compose tự đọc 2 file
```

**Cách B — Đặt trong `.env` (vĩnh viễn cho thư mục dự án):**
```bash
echo 'COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yaml' >> .env
# (lưu ý: KHÔNG commit, mỗi dev tự quyết định)
```

Khuyến nghị: **dùng script** cho consistency cả team, **fallback lệnh thuần** khi script lỗi hoặc cần debug script.

---

## 🤝 Quy ước team dev

1. **Branch convention:** `feature/<short-desc>`, `fix/<bug-name>`, `chore/<task>`. Không commit thẳng `main`.
2. **Commit message:** `<type>(<scope>): <desc>` — vd `feat(documents): add SOLID refactor for upload`.
3. **PR review:** Tự test E2E trên `docker compose up -d` (production mode) trước khi xin review, để confirm bundle thật chạy đúng.
4. **Sửa schema Prisma:** Tạo migration, commit cả file `.sql` trong `supabase/migrations/` để dev khác apply.
5. **Sửa `.env.example`:** Mỗi khi thêm biến mới vào code, phải update `.env.example` để dev khác biết. KHÔNG commit `.env` thật.
6. **Skip CI hooks:** KHÔNG dùng `--no-verify` khi git commit. Nếu lint fail, fix trước.

---

## 🆘 Khi gặp lỗi không biết hỏi ai

Trước khi nhắn team:
1. Đọc lại [docs/WSL2_SETUP.md](docs/WSL2_SETUP.md) section Troubleshooting
2. Reset stack: `dc down && dc up -d`
3. Check log: `dc logs --tail=200 <service>`
4. Search lỗi trên GitHub repo (Issues + PRs)
5. Nếu vẫn không xong → đăng vào kênh dev với:
   - Output `dc ps`
   - Last 50 dòng log của service lỗi
   - Lệnh đã chạy
   - Git branch + commit hash
