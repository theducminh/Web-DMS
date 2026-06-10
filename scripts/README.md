# scripts/ — Lệnh khởi chạy dev & ops

Bộ shell script gói các lệnh `docker compose ...` dài thành lệnh ngắn dễ nhớ. Dùng cho cả team để workflow đồng nhất, không phụ thuộc alias cá nhân.

> **Tiền đề:** Đã đọc [docs/WSL2_SETUP.md](../docs/WSL2_SETUP.md) (setup máy lần đầu) và [DEVELOPMENT.md](../DEVELOPMENT.md) (chi tiết workflow).

---

## 🚀 Quick start

```bash
# Lần đầu sau khi clone repo
./scripts/install.sh           # Verify Docker + tạo .env + chmod scripts + pull base images

# Chỉnh .env (DATABASE_URL, SMTP, OAuth, JWT_SECRET)
nano .env

# Khởi động stack dev
./scripts/dev-up.sh

# Kiểm tra trạng thái
./scripts/status.sh

# Tail log
./scripts/dev-logs.sh backend
```

---

## 📋 Danh sách script

### Setup
| Script | Mục đích |
|---|---|
| `install.sh` | Setup lần đầu sau khi clone: verify Docker + tạo `.env` + chmod scripts + pull image base |

### Dev mode (hot reload)
| Script | Mục đích | Ví dụ |
|---|---|---|
| `dev-up.sh [services...]` | Start stack dev | `./scripts/dev-up.sh` hoặc `./scripts/dev-up.sh backend frontend` |
| `dev-down.sh [-v]` | Stop stack dev (giữ data) | `./scripts/dev-down.sh` hoặc `./scripts/dev-down.sh -v` để xóa volume |
| `dev-logs.sh [services...]` | Tail log realtime | `./scripts/dev-logs.sh backend` |
| `dev-restart.sh <service>` | Restart 1 service | `./scripts/dev-restart.sh frontend` |
| `dev-shell.sh <service> [shell]` | Mở shell trong container | `./scripts/dev-shell.sh backend` |
| `dev-exec.sh <service> <cmd...>` | Chạy lệnh one-shot trong container | `./scripts/dev-exec.sh backend npx prisma migrate deploy` |
| `dev-rebuild.sh [services...]` | Rebuild image + up lại | `./scripts/dev-rebuild.sh backend` |
| `dev-debug.sh` | Start backend với Node Inspector cho VSCode debug | `./scripts/dev-debug.sh` |

### Production mode (qua Nginx HTTPS)
| Script | Mục đích | Ví dụ |
|---|---|---|
| `prod-up.sh [--build]` | Start stack production | `./scripts/prod-up.sh --build` |
| `prod-down.sh [-v]` | Stop stack production | `./scripts/prod-down.sh` |

### Ops
| Script | Mục đích | Ví dụ |
|---|---|---|
| `status.sh [--short]` | Hiển thị `compose ps` + curl 7 endpoint | `./scripts/status.sh` |
| `reset.sh [--force]` | Stop all + xóa volume + prune image | `./scripts/reset.sh` |

### Internal
| Script | Mục đích |
|---|---|
| `_common.sh` | Shared helpers (log, preflight, compose file paths). Source bởi mọi script khác — KHÔNG chạy trực tiếp. |

---

## 💡 Common workflows

### Bắt đầu ngày làm việc
```bash
cd ~/vdt-dms
git pull origin main
./scripts/dev-up.sh                    # Up stack
./scripts/dev-logs.sh backend           # Theo dõi log trong terminal khác
# Code trong VSCode (WSL Remote) -> sửa .ts -> backend tự reload
```

### Thêm npm package mới (backend)
```bash
./scripts/dev-shell.sh backend
# Trong container:
npm install <package-name>
exit
# Verify package.json đã update -> commit cùng PR
./scripts/dev-restart.sh backend
```

### Đổi schema Prisma
```bash
# Edit backend/prisma/schema.prisma
./scripts/dev-exec.sh backend npx prisma migrate dev --name "ten-migration"
./scripts/dev-exec.sh backend npx prisma generate
./scripts/dev-restart.sh backend worker
```

### Debug backend với VSCode breakpoint
```bash
./scripts/dev-debug.sh
# Trong VSCode: F5 -> "Attach to NestJS in Docker"
# Đặt breakpoint -> gọi API -> dừng tại đúng dòng .ts
```

### Smoke test luồng prod trước khi merge PR
```bash
./scripts/dev-down.sh                  # Dừng dev (port 3000 release)
./scripts/prod-up.sh --build           # Build + up bundle minified qua Nginx HTTPS
./scripts/status.sh                     # Verify 7 endpoint OK
# Test trên https://localhost/
./scripts/prod-down.sh
./scripts/dev-up.sh                    # Quay về dev mode
```

### Khi máy bị state lỗi, reset sạch
```bash
./scripts/reset.sh
# Gõ 'reset' để xác nhận. Xong xuôi -> up lại:
./scripts/dev-up.sh
```

---

## 🪟 Chạy từ Windows trực tiếp (không qua WSL terminal)?

Bộ này là **bash script**, chạy trong WSL Ubuntu. Nếu bạn muốn invoke từ Windows:

**Cách 1 — Tab WSL trong Windows Terminal:**
```powershell
wt -p "Ubuntu-22.04" -d "\\wsl.localhost\Ubuntu-22.04\home\<user>\vdt-dms"
```

**Cách 2 — Gọi `wsl` từ PowerShell:**
```powershell
wsl -d Ubuntu-22.04 -- bash -c "cd ~/vdt-dms && ./scripts/dev-up.sh"
```

**Khuyến nghị:** Cứ mở thẳng WSL terminal (Windows Terminal hoặc VSCode integrated terminal khi đang ở WSL Remote) — workflow gọn nhất.

---

## ❓ FAQ

**Q: Lần đầu chạy `dev-up.sh` rất chậm (5+ phút)?**
A: Đúng. Lần đầu container backend phải `npm install` toàn bộ deps vào volume `backend_node_modules`. Lần sau ~5s.

**Q: Sửa file .ts nhưng container không reload?**
A: Check 3 thứ: (1) Code đặt ở `~/` chứ không phải `/mnt/c/`, (2) Container backend đang chạy (`./scripts/status.sh`), (3) Log backend có dòng `Watching for file changes...` không (`./scripts/dev-logs.sh backend`).

**Q: Có cần `chmod +x` không?**
A: `./scripts/install.sh` tự chmod. Nếu skip, chạy thủ công: `chmod +x scripts/*.sh`.

**Q: Script hỏi password sudo?**
A: KHÔNG. Mọi script đều dùng Docker với user hiện tại (đã có quyền nhờ WSL Integration). Nếu bị hỏi → Docker daemon đang chạy với root, fix bằng cách thêm user vào group docker: `sudo usermod -aG docker $USER && newgrp docker`.

**Q: Có Makefile chưa?**
A: Có `Makefile` ở root cho lệnh ngắn hơn nữa (`make up`, `make logs`). Nhưng `make` cần cài, scripts/*.sh thì không. Hai bộ này dùng song song được.
