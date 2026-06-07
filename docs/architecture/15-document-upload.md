# Luồng 15 — Tải lên tài liệu (Upload Workspace)

- **Route:** `/projects/:projectId/documents/upload`
- **Component:** Upload Workspace
- **Actor:** Contributor / PM
- **Yêu cầu nguồn:** FR-2.2.1, FR-3.2.1, NFR-1.2 (SSE), NFR-2.2 (Async Diff)

## 1. Layout
- Dropzone Canvas chiếm 2/3 màn hình bên trái. Bên phải là Form Metadata:
  - Tiêu đề tài liệu (`title`).
  - Chọn Thư mục đích (`folder_id` — kế thừa từ đường dẫn hiện tại).
  - Cấp độ bảo mật ABAC (`security_level` — Dropdown: PUBLIC, INTERNAL, CONFIDENTIAL).
  - Ô Commit Message (bắt buộc) để theo dõi lịch sử chỉnh sửa.

## 2. UX States
- **Drag-Over Interaction:** kéo file vào → animation bo góc viền đứt nhấp nháy, icon tải lên lớn.
- **Client-side Pre-validation:** kiểm tra ngay ở trình duyệt — định dạng `.pdf, .docx, .md, .txt`. File > 15MB (FR-3.2.1) → nhãn vàng: *"Tài liệu > 15MB, hệ thống sẽ tắt tính năng So sánh Diff tự động và yêu cầu đối chiếu thủ công để tránh quá tải"*.
- **Upload Progress:** bấm "Bắt đầu tải lên" → Dropzone ẩn, hiện Progress Bar theo % thực tế + vận tốc (KB/s). Dùng `axios` với `onUploadProgress`.

## 3. Component Frontend
```
src/
├── pages/documents/DocumentUploadPage.tsx         # Trang không gian tải lên tài liệu
├── widgets/upload-zone/
│   ├── DropzoneCanvas.tsx                          # Khối kéo thả tệp tin
│   └── MetadataForm.tsx                            # Form thuộc tính bảo mật & commit
└── features/file-upload-stream/
    ├── model/upload-validator.ts                  # Luật kiểm tra dung lượng & định dạng (Zod)
    └── api/upload.api.ts                            # Gửi Multipart/Form-Data lên NestJS
```

## 4. Backend API
### `POST /api/v1/projects/:projectId/documents/upload`
- Headers: `Content-Type: multipart/form-data`
- Payload (Form Data):
  - `file`: [Binary]
  - `title`: "SRS_Core_v2"
  - `folderId`: "uuid"
  - `securityLevel`: "CONFIDENTIAL"
  - `commitMessage`: "Cập nhật luồng thanh toán qua QR"
  - `documentId`: "doc-123" *(tùy chọn — có thì là tải version mới, không có là tạo document mới)*
- Response (201 Created): `{ "documentId": "doc-uuid", "versionId": "ver-uuid", "message": "Tải lên thành công. File đang được xử lý ngầm." }`

## 5. Under the Hood
- **Stream to MinIO with SSE-S3:** không lưu file tạm vào ổ đĩa server (tránh nghẽn I/O). Dùng `multer` Memory Storage rồi `@aws-sdk/client-s3` đẩy thẳng Stream sang MinIO Bucket. Trong `PutObjectCommand` bắt buộc `ServerSideEncryption: 'AES256'` (NFR-1.2) để MinIO mã hóa file mức vật lý.
- **Async Job Offloading via BullMQ:** sau khi file lên MinIO trả `storage_key`, kiểm tra dung lượng. Nếu < 15MB → đẩy job vào `text-extraction-queue`. Worker chạy ở container riêng (`worker-container`) tải file về, bóc tách Raw Text, lưu ngược lại MinIO dưới dạng `raw_text_storage_key` phục vụ Diff (NFR-2.2) → cô lập rủi ro OOM với PDF lỗi cấu trúc.
- **Casbin Resource Generation:** nếu là tài liệu mới, tự sinh policy: `p, role_pm_proj001, /documents/doc-uuid, (GET|PUT|DELETE)`.
