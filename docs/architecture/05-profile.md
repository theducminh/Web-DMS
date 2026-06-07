# Luồng 05 — Hồ sơ cá nhân (My Profile)

- **Route:** `/profile`
- **Component:** My Profile
- **Actor:** System User
- **Yêu cầu nguồn:** FR-1.2.3

## 1. Layout
Asymmetric Two-Column Layout:
- *Cột trái (Thẻ định danh):* Avatar (sinh tự động từ chữ cái đầu tên), Họ tên, Email, các Thuộc tính doanh nghiệp do Admin cấp.
- *Cột phải (Thông tin cá nhân):* Form: Ngày sinh, Số điện thoại, Giới tính, Mật khẩu hiện tại (nhập để xác thực lưu).

## 2. UX States
- **Strict Input Locking:** các ô Phòng ban, Chức vụ, Email công ty, Clearance Level → disabled/read-only. Hover hiện tooltip: *"Thông tin do phòng Nhân sự/Admin quản lý, không thể tự sửa đổi"*.
- **Form Dirtiness:** nút "Lưu thay đổi" mặc định mờ/ẩn, chỉ sáng khi có thay đổi thực sự ở ô được phép sửa (Họ tên, ngày sinh, SĐT).
- **Optimistic Update:** loading cục bộ trên nút, thành công hiện Toast xanh và cập nhật ngay tên user trên Navbar qua Global State.
- **Password Confirmation Gate:** bấm "Lưu thay đổi" → bật Modal yêu cầu nhập mật khẩu hiện tại để xác nhận danh tính:
  - Ô mật khẩu có nút toggle hiển thị/ẩn (eye icon).
  - Nút "Xác nhận lưu" chỉ sáng khi ô có ≥1 ký tự.
  - Sai mật khẩu → lỗi inline dưới ô, không đóng Modal.
  - Sau 3 lần sai liên tiếp → Modal tự đóng, nút bị khóa 60 giây đếm ngược (chống brute-force).
- **Adaptive Auth Modal:** kiểm tra `auth_provider` trong Global State — `LOCAL` → ô nhập Password; `GOOGLE` → form nhập OTP 6 số (trigger gửi mail ngầm).

## 3. Component Frontend
```
src/
├── pages/profile/ProfilePage.tsx                  # Lắp ráp giao diện thông tin cá nhân
├── widgets/profile/
│   ├── UserIdentityCard.tsx                       # Thẻ thuộc tính doanh nghiệp (read-only)
│   └── PersonalDetailsForm.tsx                    # Form thông tin cá nhân được phép sửa
├── entities/user/model/user.store.ts             # Đồng bộ state user toàn app (Zustand)
└── features/update-profile/
    ├── ui/ProfileForm.tsx                          # Form chỉnh sửa thông tin cá nhân
    ├── ui/ConfirmPasswordModal.tsx                 # Modal nhập mật khẩu xác thực + đếm ngược 60s
    └── api/profile.api.ts                          # Gọi PATCH /api/v1/profile kèm currentPassword
```

## 4. Backend API
### `GET /api/v1/profile`
Response (200 OK):
```json
{
  "id": "user-uuid",
  "email": "ducnm@gmail.com",
  "fullName": "Ngô Minh Đức",
  "phone": "0988123456",
  "department": { "name": "Trung tâm Không gian mạng" },
  "title": "Junior Backend Engineer",
  "clearanceLevel": "INTERNAL",
  "dob": "2004-01-01",
  "gender": "MALE"
}
```

### `PATCH /api/v1/profile`
Payload (tài khoản LOCAL):
```json
{ "currentPassword": "OldPassword123!", "fullName": "Ngô Minh Đức", "dob": "2004-01-02", "gender": "MALE", "phone": "0988123456" }
```
Response (400 — sai mật khẩu):
```json
{ "statusCode": 400, "message": "Mật khẩu hiện tại không chính xác.", "error": "INVALID_CURRENT_PASSWORD" }
```
Payload thay thế (dùng `authContext` cho cả LOCAL và GOOGLE):
```json
{ "fullName": "Ngô Minh Đức", "authContext": { "type": "PASSWORD", "value": "OldPassword123!" } }
```
`authContext.type` có thể là `"PASSWORD"` hoặc `"OTP"`.

### `POST /api/v1/profile/request-update-otp`
Dành cho SSO User → trả 200 OK (đã gửi OTP).

## 5. Under the Hood
- **Password Verification Before Mutation:** chống kịch bản kẻ tấn công chiếm màn hình nạn nhân — `PATCH /profile` xác thực mật khẩu/OTP trước, rồi mới ghi DB.
- **Data Invalidation & Security Filter:** DTO Validation nghiêm ngặt — dù attacker chèn `{ "clearanceLevel": "CONFIDENTIAL", "department_id": "new-id" }` để tự nâng quyền, Backend tự động **strip** các trường này trước khi UPDATE.
- **Audit Log Trigger:** ghi sự kiện `PROFILE_UPDATED`.
- Backend rẽ nhánh logic xác thực dựa trên `authContext.type` trước khi thực thi Update CSDL.
