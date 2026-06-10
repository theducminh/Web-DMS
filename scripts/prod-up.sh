#!/usr/bin/env bash
# Khởi động stack ở chế độ PRODUCTION (build image, không hot reload).
# Mục đích: test luồng end-to-end qua Nginx HTTPS như khi deploy thật.

USAGE="$(cat <<'EOF'
prod-up.sh — Start stack production (KHÔNG hot reload, có Nginx HTTPS)

Usage:
  ./scripts/prod-up.sh                    # Up + build nếu chưa có image
  ./scripts/prod-up.sh --build            # Force rebuild image
  ./scripts/prod-up.sh --no-build         # Bỏ qua build, chỉ up image hiện có

Sau khi up:
  - Frontend (HTTPS qua Nginx): https://localhost/        ← demo URL chính
  - Backend Swagger:            https://localhost/api/docs
  - MinIO Console:              http://localhost:9001
  - Prometheus:                 http://localhost:9090
  - Grafana:                    http://localhost:3001 (admin / Admin@123456)

Khi nào dùng prod-up vs dev-up:
  - dev-up: Coding hằng ngày, sửa code thấy ngay
  - prod-up: Demo cho mentor, smoke test trước khi merge PR, test self-signed cert
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

# Kiểm tra xem stack dev có đang chạy không -> conflict port
if docker compose "${COMPOSE_DEV[@]}" ps --services --status running 2>/dev/null | grep -q '.'; then
  log_warn "Stack DEV đang chạy. Sẽ dừng trước khi chuyển sang prod."
  docker compose "${COMPOSE_DEV[@]}" down
fi

log_step "Start stack production"
docker compose "${COMPOSE_PROD[@]}" up -d "$@"

log_step "Trạng thái container"
docker compose "${COMPOSE_PROD[@]}" ps

log_ok "Stack production đã up tại https://localhost/"
log_info "(Cert tự ký — browser sẽ cảnh báo, bấm Advanced > Continue)"
