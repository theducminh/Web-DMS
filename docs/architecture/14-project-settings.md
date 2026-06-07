# Luồng 14 — Cấu hình dự án (Project Configuration)

- **Route:** `/projects/:projectId/settings`
- **Component:** Project Configuration
- **Actor:** PM
- **Yêu cầu nguồn:** FR-2.1.1 (Archive → Read-only)

## 1. Layout
Sectioned Form Layout:
- *General Block:* Form cập nhật Tên dự án + Mô tả. Nút "Lưu cấu hình" ở góc dưới khối.
- *Danger Zone:* dưới cùng, khung viền nét đứt đỏ. Chứa **Archive Project (Đóng băng dự án)** với nút hành động đỏ tương phản cao.

## 2. UX States
- **Danger Zone Double-Verification:** click "Archive Project" → Modal cảnh báo đỏ: *"Hành động này sẽ đóng băng toàn bộ tài liệu hiện tại về trạng thái Read-only đối với tất cả mọi người"*. PM phải gõ lại chính xác Tên dự án vào ô text thì nút "Tôi xác nhận đóng băng dự án" mới sáng.
- **Form Dirty State Verification:** nút "Lưu cấu hình" mặc định mờ, sáng khi sửa bất kỳ ký tự nào. Rời trang khi chưa lưu → cảnh báo chặn điều hướng: *"Thay đổi của bạn chưa được lưu. Bạn có chắc chắn muốn rời đi?"*
- Ở trạng thái Archived: ẩn toàn bộ form sửa tên, nút Archive biến thành "Unarchive Project".

## 3. Component Frontend
```
src/
├── pages/projects/ProjectSettingsPage.tsx         # Trang quản trị cấu hình dự án
├── widgets/project-settings/
│   ├── GeneralSettingsForm.tsx                     # Form cập nhật tên/mô tả
│   └── DangerZoneSettings.tsx                       # Khối đóng băng dự án (Danger Zone)
└── features/archive-project/
    ├── ui/ConfirmArchiveDialog.tsx                 # Modal ép nhập chữ xác nhận đóng băng
    └── api/settings.api.ts                          # API cập nhật cấu hình & trạng thái dự án
```

## 4. Backend API
### `PATCH /api/v1/projects/:projectId`
- Payload cập nhật thông tin: `{ "name": "Hệ thống Core Banking - Nhánh 2", "description": "Mô tả mới" }`
- Payload đóng băng: `{ "status": "ARCHIVED" }`
- Response (200 OK): `{ "message": "Trạng thái dự án đã được chuyển sang ARCHIVED. Toàn bộ tài liệu đã khóa." }`

### `POST /api/v1/projects/:projectId/restore` (Khôi phục)
- Response (200 OK): `{ "message": "Đã khôi phục dự án. Đội ngũ có thể tiếp tục thao tác." }`

## 5. Under the Hood
- **Cascading State Shift & Cache Invalidation:** chuyển sang `ARCHIVED` → update trường trạng thái DB, đồng thời phát `ProjectArchivedEvent` (Event-Driven). Module Tài liệu lắng nghe và quét cập nhật toàn bộ tài liệu con đang `DRAFT`/`UNDER_REVIEW` sang đóng băng tĩnh, gỡ tất cả `locked_by` đang tồn tại để giải phóng bộ nhớ.
- **Append-only Non-repudiation Audit Log:** bóc tách User ID (PM), Mã dự án, Thời gian, IP máy khách → chạy SHA-256 xích với mã băm dòng log trước (Hash Chaining) rồi ghi `audit_logs`.
