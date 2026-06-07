# Luồng 01 — Đăng nhập hợp nhất (Unified Login)

- **Route:** `/auth/login`
- **Component:** Unified Login
- **Actor:** Guest
- **Module liên quan:** `modules/auth` (Luồng 1, 2, 3, 4)
- **Yêu cầu nguồn:** FR-1.1.1, FR-1.1.2, FR-1.1.3

## 1. Layout
Split-screen (chia đôi màn hình):
- **Nửa trái (Visual/Branding):** Nền đỏ đặc trưng Viettel hoặc illustration về an toàn thông tin/quản lý tài liệu. Hiển thị logo "VDT Document Management System".
- **Nửa phải (Form tương tác):** Nền trắng, drop shadow nhẹ, căn giữa. Tối giản, form rộng ~400px.

## 2. UX States
- **Validation trực tiếp (real-time):** Ô email kiểm tra đúng định dạng ngay khi rời chuột (`onBlur`).
- **Chống brute-force:** Nhập sai mật khẩu 3 lần liên tiếp → khóa nút Login (disabled) trong 60 giây, đếm ngược trên nút.
- **Loading State:** Khi bấm đăng nhập, text "Đăng nhập" chuyển thành spinner, form mờ đi để chống double-click.
- **Error Handling (Toast):**
  - Sai tài khoản: *"Email hoặc mật khẩu không chính xác."*
  - Tài khoản bị khóa: *"Tài khoản của bạn đã bị Admin vô hiệu hóa. Vui lòng liên hệ IT Helpdesk."*

## 3. Component Frontend
```
src/
├── pages/auth/LoginPage.tsx              # Layout chia đôi màn hình (chỉ chứa UI khung)
├── widgets/auth/UnifiedLoginForm.tsx     # Gắn kết Form Email và nút Google SSO
└── features/
    ├── email-login/
    │   ├── ui/LoginForm.tsx              # Form nhập liệu & validation (React Hook Form + Zod)
    │   └── api/login.api.ts              # Gọi API NestJS
    └── google-sso/
        └── ui/GoogleButton.tsx           # Nút chuyển hướng Google OAuth2
```

## 4. Backend API
Toàn bộ luồng đăng nhập phải đi qua Backend NestJS để đảm bảo tính toàn vẹn Audit Log. Nếu dùng Supabase Auth, NestJS đóng vai trò Proxy (Nhận request → Gọi Supabase → Ghi log → Trả về Client).

### `POST /api/v1/auth/login`
Request:
```json
{ "email": "ducnm@viettel.com.vn", "password": "SecurePassword123!" }
```
Response (200 OK):
```json
{
  "message": "Đăng nhập thành công",
  "accessToken": "eyJhbGciOiJIUzI1...",
  "user": {
    "id": "uuid-1234",
    "email": "ducnm@viettel.com.vn",
    "fullName": "Ngo Minh Duc",
    "department": "Backend",
    "clearanceLevel": "L2"
  }
}
```

### `POST /api/v1/auth/refresh`
- Request: đọc `refresh_token` từ **HttpOnly Cookie** (tuyệt đối không gửi qua body để chống XSS).
- Response (200 OK): trả `access_token` mới trong JSON, set lại cookie chứa `refresh_token` mới.

### `GET /api/v1/auth/google`
Frontend gọi API này. NestJS trả về 302 Redirect, đẩy trình duyệt sang trang đăng nhập Google.

### `GET /api/v1/auth/google/callback`
- Sau khi user chọn tài khoản Google, Google gọi lại API này kèm `code`.
- Logic NestJS: đổi `code` lấy thông tin user → kiểm tra email có trong PostgreSQL chưa → nếu có, sinh JWT → redirect về `http://localhost/dashboard?token=...`
- **Ràng buộc (FR-1.1.2):** chỉ chấp nhận email đuôi domain tập đoàn (`@viettel.com.vn`). Email cá nhân (`@gmail.com`) bị từ chối ngay ở bước callback.

## 5. Under the Hood
- Dù đăng nhập thành công hay thất bại (sai pass), NestJS **bắt buộc** ghi 1 dòng log vào bảng `audit_logs`.
- Ngay khi sinh JWT, lưu `department` và `clearanceLevel` vào token. Guard NestJS lấy thông tin này ra để hỏi Casbin xem user có quyền hay không.
- Refresh: NestJS đối chiếu `refresh_token` cũ với danh sách trong Redis. Nếu hợp lệ, sinh cặp token mới và **xóa token cũ** trên Redis.
- **Chống đánh cắp (Refresh Token Rotation):** Nếu một `refresh_token` cũ (đã bị xóa) được dùng lại → token đã bị lộ. Backend lập tức **thu hồi toàn bộ phiên** của user đó và cảnh báo vào Audit Log.
