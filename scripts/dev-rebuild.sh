#!/usr/bin/env bash
# Rebuild image của 1 service (hoặc all). Chỉ cần khi đổi Dockerfile/deps lớn.
# Nếu chỉ đổi source code -> hot reload tự lo, không cần rebuild.

USAGE="$(cat <<'EOF'
dev-rebuild.sh — Rebuild image + up lại service

Usage:
  ./scripts/dev-rebuild.sh                # Rebuild tất cả
  ./scripts/dev-rebuild.sh backend        # Rebuild riêng backend
  ./scripts/dev-rebuild.sh --no-cache backend  # Rebuild bỏ cache (chậm hơn nhưng sạch)

KHI NÀO cần rebuild:
  - Đổi Dockerfile của backend/frontend/diff-engine
  - Đổi base image version (node:20 -> node:22, ...)
  - Cài package có native binding (bcrypt, sharp, ...) không tự install được trong container

KHI NÀO KHÔNG cần rebuild:
  - Sửa file .ts/.tsx/.py — hot reload tự xử lý
  - Sửa file config bind-mount (nginx.conf, prometheus.yml) — chỉ cần dev-restart.sh
  - Cài package thông thường — chỉ cần dev-restart.sh sau khi sửa package.json
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

log_step "Rebuild image"
docker compose "${COMPOSE_DEV[@]}" build "$@"

log_step "Up lại stack với image mới"
docker compose "${COMPOSE_DEV[@]}" up -d "$@"
log_ok "Xong. Verify: ./scripts/status.sh"
