#!/usr/bin/env bash
# Chạy 1 lệnh one-shot trong container (KHÔNG mở shell interactive).

USAGE="$(cat <<'EOF'
dev-exec.sh — Chạy lệnh one-shot trong container

Usage:
  ./scripts/dev-exec.sh <service> <command...>

Examples:
  ./scripts/dev-exec.sh backend npm run build
  ./scripts/dev-exec.sh backend npx prisma migrate deploy
  ./scripts/dev-exec.sh backend npx prisma generate
  ./scripts/dev-exec.sh backend node -e "console.log(process.versions)"
  ./scripts/dev-exec.sh redis redis-cli -a vdt_redis ping
  ./scripts/dev-exec.sh frontend npm install axios

Khác dev-shell.sh: lệnh chạy xong trả về ngay, không mở terminal interactive.
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

if [[ $# -lt 2 ]]; then
  log_error "Thiếu service hoặc command. VD: ./scripts/dev-exec.sh backend npm run build"
  exit 1
fi

SERVICE="$1"
shift

log_step "exec [$SERVICE]: $*"
docker compose "${COMPOSE_DEV[@]}" exec "$SERVICE" "$@"
