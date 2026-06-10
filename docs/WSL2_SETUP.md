# VDT Zero-Trust DMS — WSL2 Setup cho Dev Team

Tài liệu này hướng dẫn **mỗi developer** trong team setup máy local để dev dự án **VDT DMS** trên Windows + WSL2 (Ubuntu) + Docker Desktop.

> **Đối tượng:** Nhiều dev cùng làm 1 codebase, mỗi người trên Windows máy riêng nhưng phải đồng bộ về môi trường để không gặp lỗi "works on my machine".

---

## 🧭 TL;DR — Quyết định vị trí code

| Đặt code ở | I/O performance | Docker bind-mount | File watcher (Vite/Nest) | Khuyến nghị |
|---|---|---|---|---|
| `\\wsl$\Ubuntu\home\<user>\vdt-dms` (Linux native FS) | ⚡ Nhanh, native ext4 | ⚡ Hỗ trợ tốt | ⚡ inotify hoạt động | ✅ **DÙNG CÁI NÀY** |
| `D:\WEB SEC\` (Windows NTFS qua `/mnt/d/`) | 🐢 Chậm 5-20× | 🐢 Chậm + đôi khi sai permission | ❌ Hot-reload không bắt được file change | ❌ Chỉ dùng tạm thời |
| `C:\Users\<user>\vdt-dms` (Windows NTFS qua `/mnt/c/`) | 🐢 Chậm | 🐢 Chậm | ❌ Hot-reload không bắt | ❌ Tránh |

**Quy ước team:** Tất cả thành viên đặt code tại `~/vdt-dms/` trong WSL2 Ubuntu (= `/home/<wsl_username>/vdt-dms/`).

---

## 📦 Phần 1 — Cài đặt WSL2 + Ubuntu 22.04

### 1.1. Bật WSL2 (PowerShell as Admin)
```powershell
wsl --install -d Ubuntu-22.04
# Reboot máy sau khi cài
```

Sau reboot, Ubuntu sẽ tự mở và yêu cầu tạo username + password Linux. Ví dụ: username `duc` → home folder `/home/duc/`.

### 1.2. Verify WSL2 (KHÔNG phải WSL1)
```powershell
wsl --list --verbose
# Phải thấy: NAME: Ubuntu-22.04  STATE: Running  VERSION: 2
```

Nếu bị WSL1, convert:
```powershell
wsl --set-version Ubuntu-22.04 2
```

### 1.3. Update Ubuntu (trong WSL terminal)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

---

## 🐳 Phần 2 — Docker Desktop + WSL2 Backend

### 2.1. Cài Docker Desktop for Windows
Download tại: https://www.docker.com/products/docker-desktop/

### 2.2. Enable WSL2 integration
Mở **Docker Desktop → Settings → Resources → WSL Integration**:
- ✅ Enable integration with my default WSL distro
- ✅ Tick **Ubuntu-22.04**
- Click **Apply & Restart**

### 2.3. Verify từ WSL terminal
```bash
docker --version
# Docker version 24.x.x

docker compose version
# Docker Compose version v2.x.x

docker ps
# (rỗng nếu chưa có container)
```

Nếu thấy `Cannot connect to the Docker daemon` → restart Docker Desktop và tick lại WSL Integration.

---

## 📁 Phần 3 — Clone code vào `~/vdt-dms/`

### 3.1. SSH key cho GitHub (nếu chưa có)
```bash
cd ~
ssh-keygen -t ed25519 -C "your.email@example.com"
# Bấm Enter 3 lần (no passphrase cho thuận tiện dev)

cat ~/.ssh/id_ed25519.pub
# Copy nội dung → paste vào GitHub Settings → SSH and GPG keys → New SSH key
```

### 3.2. Clone repo
```bash
cd ~
git clone git@github.com:<org>/vdt-dms.git
# Hoặc HTTPS: git clone https://github.com/<org>/vdt-dms.git

cd ~/vdt-dms
ls -la
# Thấy: backend/ frontend/ infra/ docker-compose.yml ...
```

### 3.3. Copy `.env` (KHÔNG commit vào git)
```bash
cp .env.example .env
nano .env   # hoặc code .

# Sửa các giá trị thực:
# - DATABASE_URL (Supabase pooler)
# - SMTP_USER + SMTP_PASS (Gmail App Password)
# - GOOGLE_OAUTH_CLIENT_ID/SECRET
# - JWT_ACCESS_SECRET (sinh ngẫu nhiên: openssl rand -hex 32)
```

> ⚠️ **Quan trọng:** Mỗi dev có `.env` riêng (không commit). Liên hệ team lead để lấy bộ credentials dev hoặc tạo Supabase project riêng cho từng người.

---

## 🚀 Phần 4 — Chạy stack lần đầu

### 4.1. Production mode (full deploy giống staging)
```bash
cd ~/vdt-dms
docker compose up -d --build

# Đợi 1-2 phút build image lần đầu
docker compose ps
```

Truy cập:
- Frontend: https://localhost/
- Backend Swagger: https://localhost/api/docs
- MinIO Console: http://localhost:9001 (vdt_minio / vdt_minio_secret)
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin / Admin@123456)

### 4.2. Dev mode (hot-reload backend + frontend)
👉 Xem [DEVELOPMENT.md](../DEVELOPMENT.md) cho chi tiết.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yaml up -d
```

---

## 🔄 Phần 5 — Workflow nhiều dev cùng làm 1 codebase

### 5.1. Truy cập file WSL từ Windows (VSCode, Explorer)
Mở Windows Explorer, nhập vào address bar:
```
\\wsl.localhost\Ubuntu-22.04\home\<wsl_username>\vdt-dms
```

→ Pin vào Quick Access. Mở thư mục này trong VSCode bằng:
- Cách 1 (khuyên dùng): Trong WSL terminal: `cd ~/vdt-dms && code .` → VSCode tự chạy chế độ **WSL Remote** (chữ "WSL" hiện ở góc dưới trái).
- Cách 2: VSCode cài extension **WSL** (id: `ms-vscode-remote.remote-wsl`), bấm `F1` → "WSL: Open Folder in WSL...".

### 5.2. Tại sao KHÔNG đặt code ở `D:\WEB SEC\`?

Khi code nằm ở Windows filesystem (`/mnt/c/` hoặc `/mnt/d/`), bind-mount vào Docker container phải qua **9P protocol bridge**, gây 3 vấn đề:

1. **I/O chậm 5-20×**: `npm install` mất 8 phút thay vì 30 giây. `tsc` build 3 phút thay vì 20s.
2. **File watcher không hoạt động**: Vite HMR + NestJS `--watch` dùng `inotify`, nhưng 9P bridge không emit event. Bạn sửa code, container không reload.
3. **Permission đụng độ**: File tạo trong container thành owner `root`, host Windows không edit được; ngược lại Git checkout cờ executable bị reset.

> Đặt code ở `~/` (ext4 thật) là **bắt buộc** cho dev mode.

### 5.3. Git workflow team

```bash
# Mỗi sáng:
cd ~/vdt-dms
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.dev.yaml up -d

# Trước khi commit:
git status
git diff
git add -p   # review từng hunk
git commit -m "feat(documents): ..."
git push origin feature/abc
```

> **KHÔNG commit:** `.env`, `node_modules/`, `dist/`, `frontend/tsconfig.tsbuildinfo`, `backend/prisma/migrations/` (đã có `supabase/` ở root)

### 5.4. Khi đụng port với dev khác trên cùng máy
Nếu dev cùng máy 2 instance song song (vd: 1 cho main, 1 cho feature branch), override port:
```bash
# Trong .env của instance B:
NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
BACKEND_PORT=3010
FRONTEND_DEV_PORT=5180
```

Hoặc đơn giản: clone repo 2 lần `~/vdt-dms-main`, `~/vdt-dms-feature`, mỗi cái 1 docker-compose riêng.

---

## 🛠️ Phần 6 — Troubleshooting

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| `docker ps` báo `Cannot connect to the Docker daemon` | Docker Desktop chưa enable WSL Integration | Settings → Resources → WSL Integration → tick Ubuntu |
| `docker compose up` rất chậm khi mount source | Code đang ở `/mnt/c/` hoặc `/mnt/d/` | Move code sang `~/vdt-dms/` (xem 3.2) |
| Vite không reload khi sửa file | inotify không bắt được change qua 9P bridge | Same as above — code phải ở ext4 |
| `EACCES: permission denied` khi `npm install` | File owner root từ container ghi đè | `sudo chown -R $USER:$USER ~/vdt-dms` |
| `prisma generate` báo `Cannot find engine` | Build cache lỗi | `docker compose build --no-cache backend` |
| Port 80/443 bị Windows IIS giữ | IIS auto-start trên port 80 | `iisreset /stop` hoặc đổi port trong compose |
| WSL2 ăn hết RAM | WSL2 mặc định không giới hạn | Tạo `C:\Users\<user>\.wslconfig`: `[wsl2]\nmemory=8GB\nprocessors=4` |
| Tab WSL2 đột nhiên không truy cập được internet | DNS broken | `sudo nano /etc/resolv.conf` → `nameserver 8.8.8.8` |

### Lệnh dọn dẹp khi máy bí

```bash
# Stop tất cả container của dự án
docker compose down

# Stop + xóa volumes (dữ liệu MinIO + Redis + Prometheus + Grafana)
docker compose down -v

# Dọn image cũ
docker image prune -af

# Reset WSL khi treo (chạy từ PowerShell Windows)
wsl --shutdown
# Sau đó mở lại Ubuntu terminal
```

---

## 📋 Checklist sau khi setup xong (mỗi dev tự tick)

- [ ] WSL2 + Ubuntu-22.04 đang chạy (`wsl -l -v`)
- [ ] Docker Desktop tick WSL Integration cho Ubuntu-22.04
- [ ] `docker ps` từ WSL terminal trả về OK (không lỗi)
- [ ] Code clone tại `~/vdt-dms/` (KHÔNG ở `/mnt/c/` hoặc `/mnt/d/`)
- [ ] File `.env` đã có giá trị thực (DB, SMTP, OAuth, JWT)
- [ ] `docker compose up -d` thành công → 13+ container UP
- [ ] Truy cập https://localhost/ thấy login page
- [ ] VSCode mở project qua WSL Remote (có chữ "WSL: Ubuntu" ở góc trái dưới)
- [ ] `git config user.name` + `user.email` đã set trong WSL

Khi tất cả tick xong, bạn sẵn sàng dev. Tiếp theo đọc [DEVELOPMENT.md](../DEVELOPMENT.md) để biết cách dev từng phần (backend hot-reload, frontend HMR, debug, ...).
