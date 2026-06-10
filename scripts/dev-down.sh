#!/usr/bin/env bash
# Dừng stack dev. Mặc định GIỮ volume (data Redis/MinIO/Prometheus còn).
# Thêm --volumes hoặc -v để xóa hết (CẨN THẬN).

USAGE="$(cat <<'EOF'
dev-down.sh — Dừng stack dev

Usage:
  ./scripts/dev-down.sh           # Giữ volume (Redis/MinIO/Prometheus data còn nguyên)
  ./scripts/dev-down.sh -v        # Xóa luôn volume (XÓA dữ liệu container)
  ./scripts/dev-down.sh --volumes # Cùng nghĩa -v

Lưu ý: Lệnh này KHÔNG ảnh hưởng Supabase cloud DB.
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
      log_warn "Sẽ xóa volume: Redis cache + MinIO objects + Prometheus history + Grafana settings"
      read -rp "Tiếp tục? [y/N] " confirm
      [[ "$confirm" == "y" || "$confirm" == "Y" ]] || { log_info "Hủy."; exit 0; }
      ;;
  esac
done

log_step "Dừng stack dev"
docker compose "${COMPOSE_DEV[@]}" down "${EXTRA[@]}"
log_ok "Đã dừng."
