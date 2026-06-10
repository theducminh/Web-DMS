#!/usr/bin/env bash
# Reset toàn bộ stack: dừng all -> xóa volumes -> prune dangling images.
# Dùng khi máy bị lỗi state hoặc muốn bắt đầu lại từ đầu.

USAGE="$(cat <<'EOF'
reset.sh — RESET stack về trạng thái sạch

⚠️ Lệnh này sẽ:
  1. Dừng tất cả container của dự án
  2. Xóa volume: Redis cache + MinIO objects + Prometheus history + Grafana settings
  3. Prune image dangling (image không tag, không tham chiếu)
  4. KHÔNG ảnh hưởng Supabase cloud DB
  5. KHÔNG xóa source code

Usage:
  ./scripts/reset.sh           # Có confirmation prompt
  ./scripts/reset.sh --force   # Bỏ qua prompt (dùng trong script CI)
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

FORCE=false
for arg in "$@"; do
  [[ "$arg" == "--force" ]] && FORCE=true
done

if ! $FORCE; then
  log_warn "Sắp reset toàn bộ stack + xóa volume."
  read -rp "Gõ 'reset' để xác nhận: " confirm
  [[ "$confirm" == "reset" ]] || { log_info "Hủy."; exit 0; }
fi

log_step "Stop + remove volume cả dev và prod"
docker compose "${COMPOSE_DEV[@]}" down -v --remove-orphans 2>/dev/null || true
docker compose "${COMPOSE_PROD[@]}" down -v --remove-orphans 2>/dev/null || true

log_step "Prune dangling image"
docker image prune -f

log_ok "Stack đã reset. Up lại bằng: ./scripts/dev-up.sh"
