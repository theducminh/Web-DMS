#!/usr/bin/env bash
# Mở interactive shell trong container đang chạy.

USAGE="$(cat <<'EOF'
dev-shell.sh — Mở shell trong container

Usage:
  ./scripts/dev-shell.sh backend           # sh trong backend container
  ./scripts/dev-shell.sh frontend          # sh trong frontend container
  ./scripts/dev-shell.sh redis             # sh trong redis container
  ./scripts/dev-shell.sh backend bash      # Chỉ định shell khác (nếu container có bash)

Trong shell có thể chạy:
  - cd /app && ls               # Xem source code bind-mount
  - npm install <pkg>           # Cài deps mới (nhớ commit package.json)
  - npx prisma migrate dev      # Tạo migration mới
  - npx prisma studio --port=5555 --hostname=0.0.0.0  # GUI xem DB (sau đó port-forward)
  - node --version              # Verify version
  - exit                        # Thoát shell

Lưu ý: file tạo trong /app trong container = file ở ./<service>/ trên host
(vì bind-mount), nhưng owner sẽ là root. Nếu bị deny permission từ host:
  sudo chown -R $USER:$USER ~/vdt-dms
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"
preflight

if [[ $# -eq 0 ]]; then
  log_error "Thiếu tên service. VD: ./scripts/dev-shell.sh backend"
  exit 1
fi

SERVICE="$1"
SHELL_CMD="${2:-sh}"

log_step "Mở $SHELL_CMD trong container $SERVICE"
docker compose "${COMPOSE_DEV[@]}" exec "$SERVICE" "$SHELL_CMD"
