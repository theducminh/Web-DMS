# Luồng 26 (Bonus) — Danh mục mẫu dự án (Template Master Data)

- **Route:** `/admin/project-templates`
- **Component:** Template Master Data
- **Actor:** Admin
- **Ghi chú:** Đây là luồng mở rộng (bonus) ngoài 25 luồng cốt lõi, phục vụ Luồng 11 (Khởi tạo dự án). Bảng dữ liệu: `project_templates`, `template_folders`.

## 1. Layout
Master-Detail Split Layout (giống màn hình Departments):
- *Template List (bên trái):* các mẫu dự án (VD: Phần mềm R&D, Triển khai Hạ tầng). Mỗi dòng: Tên, Mã định danh (`template_type`), trạng thái (Active/Inactive) bằng Toggle Switch.
- *Folder Tree Builder (bên phải):* bấm vào một Template → mở giao diện trực quan xây cây thư mục chuẩn. Gồm thanh công cụ "Thêm thư mục gốc" và khung hiển thị cây (Tree View) đa cấp.

## 2. UX States
- **Interactive Tree Node:** hover vào mỗi Folder Node hiện icon: *Thêm thư mục con*, *Chỉnh sửa (Tên, Mô tả)*, *Khóa (Toggle `is_locked`)*, *Xóa*.
- **Drag-and-Drop Reordering:** kéo thả các thư mục cùng cấp đổi vị trí (`display_order`); UI tự cập nhật đường chỉ dẫn cây thư mục.
- **Locked Root Prevention:** lỡ tay xóa thư mục cốt lõi (`is_locked = true`) → rung lắc nút Xóa + Tooltip đỏ: *"Không thể xóa thư mục chuẩn của tập đoàn"*.

## 3. Component Frontend
```
src/
├── pages/admin/TemplateMasterPage.tsx             # Trang quản trị danh mục mẫu dự án
├── widgets/template-builder/
│   ├── TemplateListSidebar.tsx                     # Cột danh sách các mẫu
│   └── FolderTreeCanvas.tsx                         # Không gian kéo thả & cấu hình cây thư mục
└── features/manage-templates/
    ├── ui/TreeNodeItem.tsx                         # Component 1 node thư mục kèm menu
    └── api/template.api.ts                          # API CRUD Template & Template_Folders
```

## 4. Backend API
- `GET /api/v1/admin/project-templates` → danh sách mẫu kèm cây thư mục lồng nhau (tương tự API ở Luồng 11).
- `POST /api/v1/admin/project-templates` → tạo mẫu mới.
- `PATCH /api/v1/admin/project-templates/:id` → cập nhật tên/mô tả mẫu.
- `POST /api/v1/admin/project-templates/:id/folders`
  - Payload: `{ "name": "05_Deploy", "parentId": null, "isLocked": true, "description": "Tài liệu triển khai" }`
  - Response (201 Created): `{ "folderId": "new-uuid", "message": "Thêm thư mục vào mẫu thành công" }`
- `PATCH /api/v1/admin/project-templates/:id/folders/:folderId` → có thể chứa `name`, `isLocked`, hoặc `displayOrder`.
- `DELETE /api/v1/admin/project-templates/:id/folders/:folderId` → xóa thư mục khỏi mẫu.
- `PATCH /api/v1/admin/project-templates/:id/status` → ẩn/hiện mẫu.

## 5. Under the Hood
- **Path Materialization (tối ưu cây):** bảng `template_folders` có trường `parent_path`. Khi thêm/sửa/xóa một node, NestJS tự động tính lại và cập nhật toàn bộ `parent_path` của các node con bên dưới → lúc đọc không cần truy vấn đệ quy phức tạp, tối ưu tốc độ đọc.
- **No Cascade Delete on Active Projects:** nếu một Template đang được dùng bởi dự án hiện hành, Admin **KHÔNG** được xóa cứng. Backend chỉ cho chuyển `is_active = false` (Soft Disable) để ẩn khỏi màn hình Tạo dự án mới của PM.
