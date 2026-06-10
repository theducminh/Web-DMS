#!/usr/bin/env bash
# Setup lần đầu sau khi clone repo: copy .env, chmod scripts, verify Docker.

USAGE="$(cat <<'EOF'
install.sh — Setup máy lần đầu sau khi clone

Việc sẽ làm:
  1. Verify Docker + Docker Compose đã cài
  2. Copy .env.example -> .env nếu chưa có
  3. Chmod +x toàn bộ scripts/*.sh
  4. Pull image base (node:20-alpine, python:3.12-slim, ...) cho dev mode

Usage:
  ./scripts/install.sh
EOF
)"

source "$(dirname "$0")/_common.sh"
usage_check "$@" "$USAGE"

cd "$PROJECT_ROOT"

log_step "1. Kiểm tra Docker"
command -v docker >/dev/null || { log_error "Chưa cài Docker. Xem docs/WSL2_SETUP.md mục 2."; exit 1; }
docker info >/dev/null 2>&1 || { log_error "Docker daemon không chạy. Mở Docker Desktop + bật WSL Integration."; exit 1; }
log_ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
log_ok "Compose $(docker compose version --short)"

log_step "2. Setup .env"
if [[ -f .env ]]; then
  log_info ".env đã tồn tại — không ghi đè"
else
  cp .env.example .env
  log_ok "Đã tạo .env từ .env.example"
  log_warn "MỞ .env và điền giá trị thực cho: DATABASE_URL, SMTP_USER, SMTP_PASS, GOOGLE_OAUTH_*, JWT_ACCESS_SECRET"
  log_warn "  $ nano .env"
fi

log_step "3. Chmod scripts"
chmod +x "$PROJECT_ROOT"/scripts/*.sh
log_ok "Đã chmod +x toàn bộ scripts/*.sh"

log_step "4. Pull image base (cho dev mode tiết kiệm thời gian lần đầu)"
docker pull node:20-alpine
docker pull python:3.12-slim
docker pull prom/prometheus:latest
docker pull grafana/grafana:latest
log_ok "Image base đã có sẵn"

log_step "Hoàn tất"
log_info "Bước tiếp theo:"
log_info "  1. Sửa .env: nano .env"
log_info "  2. Up dev stack: ./scripts/dev-up.sh"
log_info "  3. Verify: ./scripts/status.sh"
log_info "  4. Đọc DEVELOPMENT.md để biết workflow dev hằng ngày"
