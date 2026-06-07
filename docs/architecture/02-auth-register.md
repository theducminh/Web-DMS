# Luồng 02 — Đăng ký nhân viên (Employee Registration)

- **Route:** `/auth/register`
- **Component:** Employee Registration
- **Actor:** Guest
- **Yêu cầu nguồn:** FR-1.2.1

## 1. Layout
- **Card-based / Stepper Layout:** Khối Card trắng giữa màn hình (~500px) trên nền xám nhạt/hình nền mờ để tập trung điền form dài.
- **Stepper:** thanh tiến độ 2 bước — Bước 1: Điền thông tin → Bước 2: Xác thực Email (OTP).

## 2. UX States
- **Smooth Transition:** điền xong Bước 1 → giao diện trượt (slide) mượt sang form nhập OTP, không reload.
- **Validation real-time:**
  - Mật khẩu: thanh đo độ mạnh (Yếu/Trung bình/Mạnh) + checklist (≥8 ký tự, 1 chữ hoa, 1 số, 1 ký tự đặc biệt), xanh khi đạt.
  - Ngày sinh (DOB): chặn chọn ngày tương lai.
- **OTP UX:** 6 ô vuông riêng biệt, gõ xong ô 1 tự nhảy ô 2; hỗ trợ paste chuỗi 6 số; đồng hồ đếm ngược gửi lại mã (59s), sau 60s mới cho click lại.
- **Error Handling (Toast):**
  - "Email này đã được đăng ký trong hệ thống."
  - "Mã OTP không chính xác hoặc đã hết hạn."

## 3. Component Frontend
```
src/
├── pages/auth/RegisterPage.tsx                    # Layout khung (Card giữa màn hình)
├── widgets/auth/EmployeeRegistrationWidget.tsx    # Quản lý State của Stepper (Step 1 <-> Step 2)
└── features/employee-register/
    ├── ui/RegisterForm.tsx                         # Form Tên, Email, Giới tính, Ngày sinh, Password
    ├── ui/OtpVerification.tsx                      # 6 ô vuông nhập OTP & nút đếm ngược
    └── api/register.api.ts                         # Gọi API NestJS (gửi yêu cầu & xác thực)
```

## 4. Backend API
### `POST /api/v1/auth/register-request`
Request:
```json
{
  "displayName": "Duc Ngo",
  "fullName": "Ngô Minh Đức",
  "email": "ducnm@gmail.com",
  "dob": "2004-01-01",
  "gender": "MALE",
  "password": "SecurePassword123!"
}
```
Response (200 OK):
```json
{ "message": "Mã xác thực đã được gửi đến ducnm@gmail.com. Vui lòng kiểm tra hộp thư.", "expiresIn": 300 }
```

### `POST /api/v1/auth/verify-register-otp`
Request:
```json
{ "email": "ducnm@gmail.com", "otp": "824615" }
```
Response (201 Created):
```json
{ "message": "Xác thực thành công. Tài khoản của bạn đã được tạo và đang chờ Admin phê duyệt.", "userId": "uuid-1234" }
```

## 5. Under the Hood
- **Xử lý Email:** Nodemailer.
- **Hashing mật khẩu:** bcrypt (Salt Rounds = 10) trước khi đẩy vào cache Redis hoặc lưu Database.
- **Luồng cấp quyền doanh nghiệp:** tài khoản mới bị ép `status = "PENDING"` và `department = NULL`. User cố login sẽ bị báo lỗi. Phải chờ Admin vào màn hình Quản lý User (Domain IAM) duyệt và gán phòng ban thì tài khoản mới có hiệu lực.
- **Audit Log:** ghi `action: "REGISTER_ATTEMPT"` ở bước 1 và `action: "REGISTER_SUCCESS"` ở bước 2 kèm IP máy khách.
