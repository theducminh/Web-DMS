# VDT Zero-Trust DMS — script chạy tắt
# Mục tiêu NFR-3.2: One-command deploy → `make up` lên toàn bộ stack 9 service.

.PHONY: help env up down logs ps restart build rebuild gencert migrate seed install verify clean

help:
	@echo "VDT Zero-Trust DMS — Makefile"
	@echo ""
	@echo "Triển khai 1-lệnh (production):"
	@echo "  make up           - Khởi chạy toàn bộ stack qua docker compose (auto-gen cert + .env nếu chưa có)"
	@echo "  make down         - Dừng và gỡ container (giữ volume)"
	@echo "  make clean        - Dừng + xóa volume (RESET DB + MinIO + Redis)"
	@echo "  make verify       - Smoke-test stack đã lên: healthz, login, audit export"
	@echo ""
	@echo "Build & quản lý:"
	@echo "  make build        - Build lại image backend + frontend"
	@echo "  make rebuild      - Build no-cache toàn bộ"
	@echo "  make logs         - Xem log realtime tất cả services"
	@echo "  make ps           - Trạng thái các container"
	@echo "  make restart      - Khởi động lại toàn stack"
	@echo ""
	@echo "Khởi tạo & dev:"
	@echo "  make env          - Tạo .env từ .env.example (nếu chưa có)"
	@echo "  make gencert      - Sinh self-signed TLS cert cho Nginx (infra/nginx/certs)"
	@echo "  make install      - npm install cho backend + frontend (local dev)"
	@echo ""
	@echo "DB (Supabase managed):"
	@echo "  make db-bootstrap - Apply 4 SQL migrations + seed lên Supabase (1 lần đầu)"
	@echo "  make db-reset     - DROP + re-create schema public (DESTRUCTIVE)"
	@echo "  make migrate      - Prisma migrate deploy (qua DIRECT_URL)"
	@echo "  make seed         - Bơm 5 demo user qua prisma/seed.ts"

# Tạo .env nếu chưa có
env:
	@test -f .env || cp .env.example .env
	@echo "✓ .env đã sẵn sàng (copy từ .env.example nếu lần đầu)."

# Sinh self-signed cert (chỉ khi chưa có) — tránh đè cert thật
gencert:
	@mkdir -p infra/nginx/certs
	@if [ ! -f infra/nginx/certs/tls.crt ] || [ ! -f infra/nginx/certs/tls.key ]; then \
		echo "→ Sinh self-signed cert..."; \
		openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
			-keyout infra/nginx/certs/tls.key \
			-out infra/nginx/certs/tls.crt \
			-subj "/C=VN/ST=Hanoi/L=Hanoi/O=Viettel/CN=dms.viettel.local" \
			-addext "subjectAltName=DNS:dms.viettel.local,DNS:localhost,IP:127.0.0.1" \
			2>&1 | grep -v '\\.\\.\\.' || true; \
		echo "✓ Cert tạo xong tại infra/nginx/certs/"; \
	else \
		echo "✓ Cert đã tồn tại — giữ nguyên (xóa thủ công nếu muốn re-gen)."; \
	fi

# 1-COMMAND DEPLOY: tự gen env + cert + build + up
up: env gencert
	@echo ""
	@echo "════════════════════════════════════════════════════════════════════"
	@echo " VDT Zero-Trust DMS — One-command deploy (NFR-3.2)"
	@echo "════════════════════════════════════════════════════════════════════"
	docker compose up -d --build
	@echo ""
	@echo "✓ Stack đang khởi động — kiểm tra trạng thái:  make ps"
	@echo "✓ Truy cập: https://localhost  (chấp nhận cảnh báo self-signed cert)"
	@echo "✓ Demo:     minhchoi2004@gmail.com / Admin@123456"
	@echo "✓ Smoke-test:  make verify"

down:
	docker compose down

clean:
	@echo "⚠ Xóa toàn bộ volume (mất DB + MinIO + Redis data). Ctrl-C trong 5s để hủy..."
	@sleep 5
	docker compose down -v

build:
	docker compose build backend frontend

rebuild:
	docker compose build --no-cache

logs:
	docker compose logs -f

ps:
	docker compose ps

restart:
	docker compose restart

migrate:
	docker compose exec backend npx prisma migrate deploy

seed:
	docker compose exec backend npx prisma db seed

# Apply schema (4 migrations + seed) lên Supabase qua psql. Chạy 1 lần khi setup project.
# Yêu cầu .env có DATABASE_URL trỏ Supabase.
db-bootstrap:
	@echo "→ Apply 4 migrations + seed lên Supabase qua DIRECT_URL (session pooler)..."
	@set -a; . ./.env; set +a; \
	  docker run --rm -v "$$(pwd)/supabase":/sql postgres:16-alpine sh -c " \
	    psql '$$DIRECT_URL' -v ON_ERROR_STOP=1 -f /sql/migrations/0001_init_schema.sql && \
	    psql '$$DIRECT_URL' -v ON_ERROR_STOP=1 -f /sql/migrations/0002_audit_integrity.sql && \
	    psql '$$DIRECT_URL' -v ON_ERROR_STOP=1 -f /sql/migrations/0003_triggers_updated_at.sql && \
	    psql '$$DIRECT_URL' -v ON_ERROR_STOP=1 -f /sql/migrations/0004_search_indexes.sql && \
	    psql '$$DIRECT_URL' -v ON_ERROR_STOP=1 -f /sql/seed.sql"
	@echo "✓ Schema Supabase đã sẵn sàng."

# Reset Supabase schema (DROP toàn bộ tables/triggers/types trong schema 'public' rồi
# re-apply). DESTRUCTIVE — chỉ dùng khi muốn factory reset.
db-reset:
	@echo "⚠ DROP public schema trong Supabase sau 5s (Ctrl-C để hủy)..."
	@sleep 5
	@set -a; . ./.env; set +a; \
	  docker run --rm postgres:16-alpine psql "$$DIRECT_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;"
	@$(MAKE) db-bootstrap

install:
	cd backend && npm install
	cd frontend && npm install

# Smoke-test toàn stack — đảm bảo deploy 1-lệnh thật sự work
verify:
	@echo "→ Kiểm tra container trạng thái..."
	@docker compose ps --format "table {{.Service}}\t{{.Status}}"
	@echo ""
	@echo "→ HEAD https://localhost/healthz (Nginx OK?)..."
	@curl -sk -o /dev/null -w "  /healthz                → %{http_code}\n" https://localhost/healthz
	@echo "→ POST /api/v1/auth/login..."
	@curl -sk -X POST https://localhost/api/v1/auth/login \
		-H "Content-Type: application/json" \
		-d '{"email":"minhchoi2004@gmail.com","password":"Admin@123456"}' \
		-o /dev/null -w "  /api/v1/auth/login      → %{http_code}\n"
	@echo "→ GET / (React SPA index)..."
	@curl -sk -o /dev/null -w "  /                       → %{http_code}\n" https://localhost/
	@echo ""
	@echo "Nếu các mã trên đều 200 → stack 1-lệnh đã chạy đúng."
