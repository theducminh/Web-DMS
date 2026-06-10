#!/usr/bin/env bash
# scripts/_common.sh — Shared helpers cho mọi script trong scripts/
# Source file này từ các script khác: source "$(dirname "$0")/_common.sh"

set -euo pipefail

# Màu sắc terminal (chỉ bật nếu output là TTY)
if [[ -t 1 ]]; then
  C_RESET='\033[0m'
  C_BOLD='\033[1m'
  C_GREEN='\033[0;32m'
  C_RED='\033[0;31m'
  C_YELLOW='\033[0;33m'
  C_BLUE='\033[0;34m'
  C_CYAN='\033[0;36m'
else
  C_RESET='' C_BOLD='' C_GREEN='' C_RED='' C_YELLOW='' C_BLUE='' C_CYAN=''
fi

log_info()    { echo -e "${C_BLUE}[i]${C_RESET} $*"; }
log_ok()      { echo -e "${C_GREEN}[✓]${C_RESET} $*"; }
log_warn()    { echo -e "${C_YELLOW}[!]${C_RESET} $*" >&2; }
log_error()   { echo -e "${C_RED}[x]${C_RESET} $*" >&2; }
log_step()    { echo -e "\n${C_BOLD}${C_CYAN}▶ $*${C_RESET}"; }

# Định vị PROJECT_ROOT từ vị trí script (luôn đứng từ root khi chạy lệnh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 2 file compose chuẩn cho dev mode
COMPOSE_DEV=(-f "$PROJECT_ROOT/docker-compose.yml" -f "$PROJECT_ROOT/docker-compose.dev.yaml")
COMPOSE_PROD=(-f "$PROJECT_ROOT/docker-compose.yml")

# Pre-flight check — gọi đầu mỗi script
preflight() {
  cd "$PROJECT_ROOT"

  if ! command -v docker >/dev/null 2>&1; then
    log_error "Chưa cài Docker. Xem docs/WSL2_SETUP.md mục 2."
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon không chạy. Khởi động Docker Desktop + bật WSL Integration."
    exit 1
  fi

  if [[ ! -f .env ]]; then
    log_warn "Thiếu file .env. Copy từ template trước khi chạy lần đầu:"
    log_warn "  cp .env.example .env  &&  nano .env"
    exit 1
  fi
}

# In help nếu user gõ -h hoặc --help (gọi: usage_check "$@" "$USAGE")
usage_check() {
  local last="${!#}"
  for arg in "$@"; do
    if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
      echo "$last"
      exit 0
    fi
  done
}
