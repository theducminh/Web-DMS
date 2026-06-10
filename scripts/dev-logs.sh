#!/usr/bin/env bash
# Tail log realtime cho 1 hoặc nhiều service. Default 200 dòng gần nhất rồi follow.

USAGE="$(cat <<'EOF'
dev-logs.sh — Tail log realtime

Usage:
  ./scripts/dev-logs.sh                       # Log tất cả service (đa luồng, hơi khó đọc)
  ./scripts/dev-logs.sh backend               # Log riêng backend
  ./scripts/dev-logs.sh backend worker        # Log nhiều service cùng lúc
  ./scripts/dev-logs.sh --tail=50 backend     # 50 dòng cuối thay vì 200
  ./scripts/dev-logs.sh --no-follow backend   # Print 1 lần rồi thoát (không follow)

Service phổ biến: backend, worker, frontend, diff-engine, nginx, redis, minio,
                  prometheus, grafana, node-exporter, cadvisor, redis-exporter

Bấm Ctrl+C để thoát follow mode.
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

# Tách --tail và --no-follow ra args riêng
TAIL_LINES=200
FOLLOW="-f"
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --tail=*)      TAIL_LINES="${arg#--tail=}" ;;
    --no-follow)   FOLLOW="" ;;
    *)             ARGS+=("$arg") ;;
  esac
done

log_step "Tail log (200 dòng cuối + follow)"
docker compose "${COMPOSE_DEV[@]}" logs --tail="$TAIL_LINES" $FOLLOW "${ARGS[@]}"
