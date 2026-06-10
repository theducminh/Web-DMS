#!/usr/bin/env bash
# Khởi động stack ở chế độ DEV (hot-reload backend + worker + frontend + diff-engine).
#
# Usage:
#   ./scripts/dev-up.sh                  # Up tất cả service dev
#   ./scripts/dev-up.sh backend          # Up chỉ backend
#   ./scripts/dev-up.sh backend frontend # Up nhiều service
#   ./scripts/dev-up.sh --build          # Pull/rebuild image trước khi up
#   ./scripts/dev-up.sh -h               # In help

USAGE="$(cat <<'EOF'
dev-up.sh — Start stack ở chế độ dev (hot reload)

Examples:
  ./scripts/dev-up.sh
  ./scripts/dev-up.sh backend worker
  ./scripts/dev-up.sh --build

Sau khi up:
  - Backend API:     http://localhost:3000/api/v1
  - Backend metrics: http://localhost:3000/api/v1/metrics
  - Frontend Vite:   http://localhost:5173  (HMR enabled)
  - Diff Engine:     http://localhost:8000
  - Prometheus:      http://localhost:9090
  - Grafana:         http://localhost:3001  (admin / Admin@123456)
  - Node Inspector:  127.0.0.1:9229         (VSCode attach)
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

log_step "Khởi động stack dev (hot-reload)"

docker compose "${COMPOSE_DEV[@]}" up -d "$@"

log_step "Trạng thái container"
docker compose "${COMPOSE_DEV[@]}" ps

log_ok "Stack dev đã up. Theo dõi log: ./scripts/dev-logs.sh <service>"
log_info "Lần đầu up sẽ mất ~3-5 phút để cài npm packages trong container — kiên nhẫn."
