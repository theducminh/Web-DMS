#!/usr/bin/env bash
# Hiển thị trạng thái stack hiện tại (cả dev và prod overlap), kèm verify endpoint.

USAGE="$(cat <<'EOF'
status.sh — Kiểm tra trạng thái stack + health endpoints

Usage:
  ./scripts/status.sh           # Status đầy đủ
  ./scripts/status.sh --short   # Chỉ docker compose ps, không curl endpoint
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

SHORT=false
for arg in "$@"; do
  [[ "$arg" == "--short" ]] && SHORT=true
done

log_step "Container đang chạy"
docker compose "${COMPOSE_DEV[@]}" ps 2>/dev/null || docker compose "${COMPOSE_PROD[@]}" ps

if $SHORT; then exit 0; fi

log_step "Health check endpoints"

check_url() {
  local label="$1" url="$2"
  if curl -sk -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null | grep -qE "^(2|3)"; then
    log_ok "$label  $url"
  else
    log_warn "$label  $url  (không trả lời / không 2xx)"
  fi
}

check_url "Backend metrics" "http://localhost:3000/api/v1/metrics"
check_url "Frontend (Vite) " "http://localhost:5173/"
check_url "Frontend (Nginx)" "https://localhost/"
check_url "Diff Engine     " "http://localhost:8000/health"
check_url "Prometheus      " "http://localhost:9090/-/ready"
check_url "Grafana         " "http://localhost:3001/api/health"
check_url "MinIO Console   " "http://localhost:9001/"
