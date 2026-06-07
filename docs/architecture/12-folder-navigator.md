# Luồng 12 — Trình duyệt thư mục (Folder Navigator)

- **Route:** `/projects/:projectId/folders/:folderId`
- **Component:** Folder Navigator
- **Actor:** System User / Contributor / PM
- **Yêu cầu nguồn:** FR-2.2.3 (Soft Delete), FR-2.1.1 (Archived Read-only), Pessimistic Locking

## 1. Layout
File Explorer Layout (giống Windows Explorer / Google Drive):
- *Header & Breadcrumbs:* chuỗi liên kết thư mục (VD: `Dự án A > 01_SRS > 01_Nghiep_vu_loi`), ô tìm kiếm tài liệu trong thư mục hiện tại, nút "Tải lên tài liệu" và "Tạo thư mục con" (mờ nếu bị giới hạn bởi template gốc).
- *Main List View:* danh sách song song folders + documents. Cột: Tên (icon phân biệt file/folder), `version_no`, Trạng thái (DRAFT, UNDER_REVIEW, RELEASED), Người cập nhật cuối, Ngày sửa.
- *Project Trash:* nút "Thùng rác dự án" trong màn hình Settings — danh sách file xóa mềm + "Khôi phục" / "Xóa vĩnh viễn" (Hard Delete chỉ Admin).

## 2. UX States
- **Drag-and-Drop Area:** kéo file (PDF, Docx, MD) vào trình duyệt → overlay xanh mờ + text: *"Thả file tại đây để tự động kích hoạt Module tải lên"*.
- **Pessimistic Locking Indicator:** tài liệu đang bị sửa → icon Khóa cam + Tooltip *"Tài liệu đang bị khóa bởi [Họ tên] để tránh xung đột ghi đè"*. Người khác bị mờ nút "Upload đè bản mới".
- **Skeleton Row Loading:** lướt mờ từng dòng khi chuyển thư mục.

## 3. Component Frontend
```
src/
├── pages/projects/FolderNavigatorPage.tsx         # Trang điều hướng tệp tin & thư mục
├── widgets/file-explorer/
│   ├── BreadcrumbNavigation.tsx                    # Thanh chuyển cấp thư mục
│   └── FileDirectoryTable.tsx                       # Bảng danh sách file/folder con
└── features/
    ├── folder-actions/
    │   ├── ui/CreateFolderModal.tsx                # Modal tạo nhanh thư mục con
    │   └── api/folder.api.ts                        # API lấy nội dung & tạo folder
    └── document-row-menu/ui/ActionDropdown.tsx     # Menu tác vụ nhanh (Xem Diff, Gửi Duyệt, Xóa mềm)
```

## 4. Backend API
### `GET /api/v1/projects/:projectId/folders/:folderId`
Response (200 OK):
```json
{
  "currentFolder": { "id": "folder-uuid", "name": "01_SRS" },
  "breadcrumbs": [
    { "id": "root", "name": "Dự án A" },
    { "id": "folder-uuid-parent", "name": "01_SRS" },
    { "id": "folder-uuid", "name": "01_Nghiep_vu_loi" }
  ],
  "subFolders": [ { "id": "sub-uuid-1", "name": "Vòng_1_Core_Specs", "createdAt": "2026-05-22T00:00:00Z" } ],
  "documents": [
    { "id": "doc-uuid-999", "title": "SRS_Yeu_Cau_He_Thong.pdf", "securityLevel": "INTERNAL", "status": "RELEASED", "currentVersion": 2, "lockedBy": null, "updatedAt": "2026-05-22T05:00:00Z" }
  ]
}
```

### Khóa tài liệu (Pessimistic Lock)
- `POST /api/v1/documents/:docId/lock` → `{ "lockedBy": "user-uuid-123", "lockedAt": "...", "expiresAt": "..." }`
- `DELETE /api/v1/documents/:docId/lock` → `{ "message": "Đã mở khóa tài liệu thành công." }`
- `PATCH /api/v1/documents/:docId/lock/heartbeat` → gia hạn TTL (FE gọi mỗi 10 phút khi còn mở tab edit). `{ "message": "Gia hạn khóa thành công.", "newExpiresAt": "..." }`
- `DELETE /api/v1/documents/:docId/lock/force` → chỉ PROJECT_MANAGER, mở khóa ép buộc. `{ "message": "Đã mở khóa ép buộc. Hành động này đã được ghi vào Audit Log." }`

### Workflow & quản lý file
- `PATCH /api/v1/documents/:docId/submit-review` → `{ "newStatus": "UNDER_REVIEW", "message": "Đã gửi yêu cầu phê duyệt. Tài liệu hiện đang bị khóa chờ PM xử lý." }`
- `DELETE /api/v1/documents/:docId` → xóa mềm: `{ "message": "Tài liệu đã được chuyển vào thùng rác." }`
- `POST /api/v1/projects/:projectId/folders` → tạo folder. Payload: `{ "name": "01_Tailieu_Hop", "parentId": "folder-uuid-hientai" }`
- `PATCH /api/v1/projects/:projectId/folders/:folderId` → đổi tên/di chuyển. Payload: `{ "name": "01_SRS_Updated", "parentId": "new-parent-uuid" }`
- `PATCH /api/v1/documents/:docId/move` → `{ "newFolderId": "uuid-folder-dich" }`
- `GET /api/v1/projects/:projectId/trash` → danh sách documents có `is_deleted = true`
- `POST /api/v1/documents/:docId/restore-trash` → đảo cờ `is_deleted = false`, trả file về thư mục gốc

## 5. Under the Hood
- **Hierarchical Tree Query & Soft Delete Filter:** truy vấn nội dung thư mục dùng `where: { parent_id: folderId, is_deleted: false }`. File xóa mềm ẩn khỏi Dev/QA nhưng không mất vật lý (FR-2.2.3).
- **Archived Project Read-Only Guard:** nếu dự án cha `ARCHIVED`, mọi endpoint đột biến (POST /folders, POST /documents/upload) bị chặn từ Middleware, trả 403 → ép Read-only.
- **Breadcrumbs Generator:** Prisma chưa hỗ trợ Recursive CTE hoàn hảo → dùng SQL thuần:
```sql
WITH RECURSIVE folder_tree AS (
  SELECT id, name, parent_id FROM folders WHERE id = $1
  UNION ALL
  SELECT f.id, f.name, f.parent_id FROM folders f
  INNER JOIN folder_tree ft ON f.id = ft.parent_id
) SELECT * FROM folder_tree;
```
- **Redis Locking Mechanism:** lưu trạng thái khóa vào Redis: `SETEX doc:lock:doc-uuid-999 7200 "user-1"` (7200s = 2 tiếng, tự hết hạn mở khóa). API danh sách quét Redis map trạng thái lock vào Response — nhẹ hơn job quét DB.
- **Soft Delete Guard:** không `DELETE FROM documents`, chỉ `UPDATE documents SET is_deleted = true`. ABAC chỉ cho PROJECT_MANAGER hoặc `created_by` gọi. Nếu file đang khóa, lệnh xóa gỡ luôn khóa; hành động băm chuỗi (Hash Chaining) vào `audit_logs`.
- **State Machine Validation (submit-review):** status hiện tại bắt buộc `DRAFT`; chuyển `UNDER_REVIEW`, đặt `locked_by = 'SYSTEM'` (Systemic Hard Lock cấm mọi Contributor sửa khi Reviewer đang đọc); đẩy event BullMQ gửi email PM.
- **Template Constraint / Lock Guard:** thêm/đổi tên thư mục → check `is_locked`; nếu cha `is_locked = true` → 403 bảo vệ template gốc.
- **Cycle Detection:** khi đổi `parentId`, chặn Circular Reference (không cho thư mục cha chuyển vào con của nó).
- **Trash Access:** Guard từ chối nếu là CONTRIBUTOR/VIEWER; chỉ PM/ADMIN truy cập `/trash`.
- **Upload limit (Multer):** `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))` — Hard limit 50MB chặn từ Gateway, >50MB ném `PayloadTooLargeException (413)`.
  - Dưới 50MB: cho phép Upload lên MinIO.
  - 0–15MB: bắn job BullMQ bóc tách text phục vụ Diff.
  - 15–50MB: upload thành công nhưng đánh cờ `text_extracted = false`, tắt Diff tự động.
- **Published Version logic:** v1.0 được duyệt → `status = RELEASED`, `published_version_id = ID v1.0`. BA upload đè v2.0 → `status = DRAFT` nhưng `published_version_id` vẫn giữ v1.0. Dev/QA gọi `GET /documents/:docId`: nếu status `DRAFT/UNDER_REVIEW`, Backend tự bẻ hướng query lấy `published_version_id` trả về. Chỉ PM và BA thấy bản DRAFT v2.0.
- **`navigator.sendBeacon()`:** tab đóng đột ngột (`beforeunload`/`pagehide`) → FE bắn beacon nhẹ tới `DELETE /lock` để trả khóa ngay.
