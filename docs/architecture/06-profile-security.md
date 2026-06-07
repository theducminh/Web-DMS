# Luồng 06 — An toàn tài khoản (Account Security)

- **Route:** `/profile/security`
- **Component:** Account Security
- **Actor:** System User
- **Yêu cầu nguồn:** FR-1.1.3

## 1. Layout
Split-Grid Layout, hai phân vùng độc lập:
- *Bên trái (Quản lý mật khẩu):* Form đổi mật khẩu — Mật khẩu hiện tại, Mật khẩu mới, Nhập lại.
- *Bên phải (Quản lý thiết bị & phiên):* List View các thiết bị/trình duyệt đang có phiên (Active Sessions). Mỗi dòng: icon thiết bị, tên trình duyệt/OS, IP, thời gian đăng nhập gần nhất, vị trí ước tính, nút "Đăng xuất thiết bị" (Revoke Session).

## 2. UX States
- **Real-time Password Validation:** Zod kiểm tra độ mạnh mật khẩu mới; nút "Cập nhật mật khẩu" chỉ kích hoạt khi mật khẩu mới khác cũ và khớp ô nhập lại.
- **Session Revocation UX:** bấm "Đăng xuất thiết bị"/"Đăng xuất tất cả thiết bị khác" → Modal xác nhận; dòng session chuyển opacity 50% + spinner trước khi biến mất.
- **Error Handling (Toast):**
  - "Mật khẩu hiện tại không chính xác."
  - "Mật khẩu mới không được trùng với mật khẩu cũ."

## 3. Component Frontend
```
src/
├── pages/profile/SecurityPage.tsx                 # Khung giao diện an toàn tài khoản
├── widgets/security/
│   ├── ChangePasswordForm.tsx                     # Khối đổi mật khẩu (validation logic)
│   └── ActiveSessionsList.tsx                     # Khối quản lý & hiển thị danh sách phiên
└── features/
    ├── password-update/api/change-password.api.ts # API đổi mật khẩu
    └── session-management/
        ├── ui/SessionRow.tsx                       # Một dòng phiên
        └── api/session.api.ts                      # API lấy & hủy phiên làm việc
```

## 4. Backend API
### `POST /api/v1/profile/change-password`
- Payload: `{ "currentPassword": "OldPassword123!", "newPassword": "NewStrictPassword2026!" }`
- Response (200 OK): `{ "message": "Đổi mật khẩu thành công." }`

### `GET /api/v1/profile/sessions`
Response (200 OK):
```json
[
  {
    "id": "session-uuid-999",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)... Chrome/120.0",
    "ipAddress": "11.22.33.44",
    "isCurrent": true,
    "lastActiveAt": "2026-05-22T12:00:00Z"
  }
]
```

### `DELETE /api/v1/profile/sessions/:sessionId`
- Response (200 OK): `{ "message": "Đã hủy phiên làm việc thành công." }`

### `DELETE /api/v1/profile/sessions/others` (Panic Button — đăng xuất tất cả trừ máy hiện tại)
- Response (200 OK): `{ "message": "Đã đăng xuất toàn bộ các thiết bị khác." }`

## 5. Under the Hood
- **Redis Session Store:** thay vì Stateless JWT thuần (không thu hồi được phiên), mỗi `refresh_token`/`session_id` lưu trong Redis Set với key `user:sessions:<user_id>` → cho phép quản lý nhiều phiên đa thiết bị và thu hồi từng phiên (Zero-Trust).
- **Immediate Token Blacklisting:** khi đổi mật khẩu / đăng xuất thiết bị đáng ngờ:
  - Xóa `session_id` tương ứng khỏi Redis Session Store.
  - Đưa `jti` (JWT ID) của Access Token vào Redis Blacklist với TTL bằng đúng thời gian sống còn lại của token (ví dụ 15 phút).
  - Mọi request tiếp theo dùng Access Token cũ → Gateway từ chối `401 Unauthorized`.
- **Audit Trail:** ghi log `PASSWORD_CHANGED`, `SESSION_REVOKED`, `FORCE_LOGOUT`.
