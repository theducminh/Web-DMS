#!/usr/bin/env bash
# Restart 1 hoặc nhiều service mà không up lại toàn stack.

USAGE="$(cat <<'EOF'
dev-restart.sh — Restart service

Usage:
  ./scripts/dev-restart.sh backend         # Restart 1 service
  ./scripts/dev-restart.sh frontend nginx  # Restart nhiều service

Dùng khi:
  - Sửa file config không thuộc bind-mount (vd: docker-compose.yml)
  - Container bị treo, muốn reset state
  - Thêm package mới vào package.json -> restart để pick up
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

if [[ $# -eq 0 ]]; then
  log_error "Thiếu tên service. Xem: ./scripts/dev-restart.sh --help"
  exit 1
fi

log_step "Restart: $*"
docker compose "${COMPOSE_DEV[@]}" restart "$@"
log_ok "Đã restart. Xem log: ./scripts/dev-logs.sh $*"
