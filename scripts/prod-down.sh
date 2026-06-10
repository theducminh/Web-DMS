#!/usr/bin/env bash
# Dừng stack production.

USAGE="$(cat <<'EOF'
prod-down.sh — Dừng stack production

Usage:
  ./scripts/prod-down.sh           # Giữ volume
  ./scripts/prod-down.sh -v        # Xóa volume luôn
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

EXTRA=()
for arg in "$@"; do
  case "$arg" in
    -v|--volumes)
      EXTRA+=(-v)
      log_warn "Sẽ xóa volume (Redis/MinIO/Prometheus/Grafana data)"
      read -rp "Tiếp tục? [y/N] " confirm
      [[ "$confirm" == "y" || "$confirm" == "Y" ]] || { log_info "Hủy."; exit 0; }
      ;;
  esac
done

log_step "Dừng stack production"
docker compose "${COMPOSE_PROD[@]}" down "${EXTRA[@]}"
log_ok "Đã dừng."
