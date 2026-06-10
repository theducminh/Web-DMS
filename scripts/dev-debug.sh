#!/usr/bin/env bash
# Start backend với Node Inspector enable để VSCode/Chrome DevTools attach.
# Khác dev-up.sh ở chỗ override command: thêm --inspect=0.0.0.0:9229
# (Mặc định dev-up.sh chỉ chạy nest start --watch, KHÔNG bật inspector.)

USAGE="$(cat <<'EOF'
dev-debug.sh — Start backend với Node Inspector cho VSCode debug

Cách dùng:
  1. ./scripts/dev-debug.sh                    # Start backend (+ worker + diff-engine + redis + minio)
  2. Trong VSCode: F5 -> chọn "Attach to NestJS in Docker"
     (cần có .vscode/launch.json — xem DEVELOPMENT.md mục Dev BACKEND)
  3. Đặt breakpoint trong file .ts -> gọi API -> dừng tại breakpoint

Quy ước port:
  - 3000: HTTP API
  - 9229: Node Inspector (debugger)

Để dừng: ./scripts/dev-down.sh
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

# Tạo file override tạm thời chứa command có --inspect
DEBUG_OVERRIDE="$PROJECT_ROOT/docker-compose.debug.yaml"
cat > "$DEBUG_OVERRIDE" <<'YAML'
# AUTO-GENERATED bởi scripts/dev-debug.sh — KHÔNG commit file này vào git.
# Mục đích: override command backend để chạy với Node Inspector cho debugger.

services:
  backend:
    command:
      - sh
      - -c
      - "apk add --no-cache openssl && npm install --no-audit --no-fund && npx prisma generate && node --inspect=0.0.0.0:9229 node_modules/@nestjs/cli/bin/nest.js start --watch"
YAML

log_step "Start backend debug mode (Node Inspector 9229)"
docker compose -f "$PROJECT_ROOT/docker-compose.yml" -f "$PROJECT_ROOT/docker-compose.dev.yaml" -f "$DEBUG_OVERRIDE" up -d backend worker frontend diff-engine redis minio

log_step "Verify port 9229"
sleep 3
if docker compose -f "$PROJECT_ROOT/docker-compose.yml" -f "$PROJECT_ROOT/docker-compose.dev.yaml" -f "$DEBUG_OVERRIDE" port backend 9229 2>/dev/null | grep -q .; then
  log_ok "Node Inspector listening 0.0.0.0:9229"
else
  log_warn "Chưa thấy port 9229 publish — đợi backend boot xong (~30s) rồi kiểm tra log:"
  log_warn "  ./scripts/dev-logs.sh backend"
fi

log_info "Trong VSCode: bấm F5 -> chọn 'Attach to NestJS in Docker'"
log_info "Đặt breakpoint trong file backend/src/**/*.ts -> gọi API tới http://localhost:3000/api/v1/..."
log_info "Để dừng debug mode: ./scripts/dev-down.sh"
