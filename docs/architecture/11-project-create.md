# Luồng 11 — Khởi tạo dự án (Project Initialization)

- **Route:** `/projects/create`
- **Component:** Project Initialization
- **Actor:** PM / Admin
- **Yêu cầu nguồn:** FR-2.1.1, FR-2.1.2

## 1. Layout
Form Wizard / Stepper Layout, 2 bước trên một Card nền trắng lớn:
- *Bước 1 (Thông tin & Chuẩn hóa cấu trúc):* ô nhập Tên dự án, Mô tả, và **Khối chọn Mẫu cây thư mục (Project Template)** theo chuẩn tập đoàn (VD: Mẫu Phần mềm R&D, Mẫu Triển khai Hạ tầng). Click vào mẫu → hiển thị Preview Tree cây thư mục sẽ được sinh ra.
- *Bước 2 (Cơ cấu Đội ngũ):* tìm kiếm nhanh nhân sự và gán vai trò ban đầu (PM, CONTRIBUTOR, REVIEWER, VIEWER).

## 2. UX States
- **Template Preview Interaction:** mẫu hiển thị dạng Radio Cards; click đổi mẫu → cây thư mục render lại theo dữ liệu `GET /api/v1/project-templates`. Icon phân biệt:
  - 🔒 Icon khóa xám: thư mục cốt lõi `is_locked = true`, không xóa/đổi tên. Tooltip: *"Thư mục bắt buộc theo chuẩn tập đoàn"*.
  - 📁 Icon thường: thư mục tùy chọn `is_locked = false`, PM có thể xóa/thêm con sau.
  - Hover hiện `description` gợi ý loại tài liệu nên đặt.
- **Real-time Name Check:** `onBlur` tên dự án → gọi API check trùng, trùng thì viền đỏ.
- **Loading Placement:** bấm "Khởi tạo không gian làm việc" → nút Loading, khóa nút "Quay lại"/"Hủy" để bảo vệ Transaction đang chạy.

## 3. Component Frontend
```
src/
├── pages/projects/ProjectCreatePage.tsx           # Trang điều phối luồng tạo mới dự án
├── widgets/project-wizard/
│   ├── ProjectInfoStep.tsx                         # Form metadata & chọn cấu trúc thư mục mẫu
│   └── ProjectTeamStep.tsx                          # Gán nhân sự và vai trò dự án
└── features/initialize-project/
    ├── ui/TemplateCard.tsx                          # Thẻ cấu hình mẫu thư mục chuẩn
    ├── ui/FolderStructurePreview.tsx               # Cây thư mục mẫu trực quan
    └── api/create-project.api.ts                    # API gửi payload khởi tạo dự án
```

## 4. Backend API
### `POST /api/v1/projects`
Payload:
```json
{
  "name": "Hệ thống Quản lý Tài liệu VDT 2026",
  "description": "Chuẩn hóa quy trình tài liệu kỹ thuật",
  "templateType": "SOFTWARE_DEV",
  "initialMembers": [
    { "userId": "user-uuid-999", "projectRole": "REVIEWER" }
  ]
}
```
Response (201 Created): `{ "projectId": "new-proj-uuid", "message": "Khởi tạo dự án và cây thư mục chuẩn hóa thành công." }`

### `GET /api/v1/project-templates`
Lấy danh sách mẫu dự án + cấu trúc thư mục để Preview. Response (200 OK):
```json
[
  {
    "id": "tmpl-uuid-001",
    "name": "Dự án Phần mềm R&D",
    "templateType": "SOFTWARE_DEV",
    "description": "Chuẩn hóa tài liệu cho các dự án phát triển phần mềm nội bộ",
    "folders": [
      {
        "name": "01_SRS", "parentPath": null, "isLocked": true, "displayOrder": 1,
        "description": "Tài liệu đặc tả yêu cầu hệ thống",
        "children": [
          { "name": "Vong_1", "isLocked": false, "displayOrder": 1 },
          { "name": "Vong_2", "isLocked": false, "displayOrder": 2 }
        ]
      },
      { "name": "02_Design",   "parentPath": null, "isLocked": true,  "displayOrder": 2 },
      { "name": "03_API_Spec", "parentPath": null, "isLocked": true,  "displayOrder": 3 },
      { "name": "04_Test",     "parentPath": null, "isLocked": false, "displayOrder": 4 }
    ]
  }
]
```

## 5. Under the Hood
- **ACID Database Transaction & Folder Auto-Generation:** toàn bộ chuỗi chạy trong một khối `$transaction` của Prisma (nguyên tử — thành công hoàn toàn hoặc rollback toàn bộ). Không hardcode cấu trúc thư mục; thay đổi chuẩn chỉ cần cập nhật bảng `template_folders`, không deploy lại:
  1. Tạo bản ghi mới trong `projects` (gán `owner_id` = ID của PM tạo).
  2. Tự động thêm PM đó vào `project_members` với `project_role = 'PM'`.
  3. Đọc cấu hình mẫu thư mục (`templateType`), chạy vòng lặp `INSERT INTO folders` sinh các thư mục con mặc định (SRS, Design, API_Spec) liên kết với ID dự án.
  4. Nếu có `initialMembers`, tạo các bản ghi phân quyền tương ứng.
  - Bất kỳ bước nào lỗi → Rollback toàn bộ.
- **Casbin Policy Sync:** đẩy bản ghi phân quyền cơ sở vào Casbin để PM toàn quyền: `(p, role_pm_<project_id>, /api/v1/projects/<project_id>/*, *)`.
- **Audit Trail:** ghi log `PROJECT_INITIALIZED` cùng payload.
