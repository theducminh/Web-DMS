# Luồng 03 — Khôi phục mật khẩu (Password Recovery)

- **Route:** `/auth/forgot-password`
- **Component:** Password Recovery
- **Actor:** Guest

## 1. Layout
Card-based Layout đồng bộ với màn hình Đăng ký, đặt giữa màn hình tối giản. Chia 3 bước theo Stepper:
- *Bước 1:* Nhập email khôi phục.
- *Bước 2:* Xác thực mã OTP (6 ô vuông).
- *Bước 3:* Thiết lập mật khẩu mới.

## 2. UX States
- **Email Validation:** kiểm tra định dạng ngay (`onBlur`). Chỉ hiện nút "Gửi mã" nếu email đúng cú pháp tên miền doanh nghiệp.
- **OTP Rate-Limiting Display:** đếm ngược 60 giây trước khi cho bấm lại "Gửi lại mã".
- **Password Strength Meter:** thanh đo + checklist độ phức tạp theo thời gian thực (>8 ký tự, chữ hoa/thường, số, ký tự đặc biệt). Chỉ mở khóa nút "Xác nhận đổi mật khẩu" khi checklist xanh 100%.
- **OTP nhập liệu:** dùng `onPaste` trên container, tách chuỗi paste thành mảng ký tự rồi `setValue` từng ô; auto-submit khi ô thứ 6 có giá trị; đếm ngược dùng `useEffect` + `setInterval`, lưu `isResendDisabled` trong local state.
- **Error/Toast:**
  - "Nếu email tồn tại, một mã OTP đã được gửi đi" (thông báo chung chung chống User Enumeration).
  - "Mã OTP không chính xác hoặc đã hết hạn."

## 3. Component Frontend
```
src/
├── pages/auth/ForgotPasswordPage.tsx              # Khung layout bọc ngoài
├── widgets/auth/PasswordRecoveryWidget.tsx        # Quản lý state chuyển đổi giữa 3 bước
└── features/password-recovery/
    ├── ui/RequestOtpForm.tsx                       # Form nhập email
    ├── ui/VerifyOtpInput.tsx                       # 6 ô input OTP liền mạch
    ├── ui/ResetPasswordForm.tsx                    # Form đặt mật khẩu mới
    └── api/forgot-password.api.ts                  # Các cuộc gọi API phục hồi mật khẩu
```

## 4. Backend API
### `POST /api/v1/auth/forgot-password-request`
- Payload: `{ "email": "ducnm@viettel.com.vn" }`
- Response (200 OK): `{ "message": "Mã xác thực đã được gửi nếu tài khoản tồn tại", "token": "temp-session-uuid" }`

### `POST /api/v1/auth/reset-password-confirm`
- Payload: `{ "email": "ducnm@viettel.com.vn", "otp": "123456", "newPassword": "StrictPassword2026!" }`
- Response (200 OK): `{ "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." }`

## 5. Under the Hood
- **Redis OTP Storage:** sinh OTP 6 chữ số, lưu Redis với key `otp:forgot:` kèm TTL = 5 phút.
- **Force Session Eviction (quan trọng nhất):** ngay sau khi đổi mật khẩu thành công, Backend xóa toàn bộ JWT Refresh Token hiện có của user trên Redis (Blacklist hoặc xóa key `session:<user_id>:*`) → Force Logout mọi thiết bị, ngăn kẻ tấn công dùng phiên cũ.
- **Audit Log:** ghi chuỗi `PASSWORD_RESET_REQUESTED` và `PASSWORD_RESET_SUCCESS` kèm IP để theo dõi bất thường.
