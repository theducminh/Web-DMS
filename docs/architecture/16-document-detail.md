# Luồng 16 — Bảng điều khiển tài liệu (Document Dashboard)

- **Route:** `/documents/:docId/detail`
- **Component:** Document Dashboard
- **Actor:** System User / Contributor / PM
- **Yêu cầu nguồn:** FR-2.3.2, FR-3.1.2 (Rollback), FR-3.1.3, FR-5.3.1 (Anomaly)

## 1. Layout
Tabbed Dashboard Layout, 3 phân vùng:
- *Tab 1: Preview:* trình đọc trực tiếp (PDF Viewer / Markdown Reader) — xem nhanh không cần tải về.
- *Tab 2: Metadata & ABAC Settings:* ma trận thuộc tính tài liệu (Vòng đời, Cấp độ mật, Người tạo, Dự án cha) và các luật ABAC ràng buộc lên tài liệu.
- *Tab 3: Version History:* Timeline mỗi mốc hiển thị số phiên bản (v1.0, v2.0), người cập nhật, thời gian, commit message. Mỗi phiên bản có checkbox chọn so sánh Diff.

## 2. UX States
- **Pessimistic Edit Locking UI:** bấm "Bắt đầu chỉnh sửa" → kiểm tra khóa. Chưa khóa → giao diện chuyển cam nhạt, icon ổ khóa mở, gửi lệnh khóa. Đã bị người khác khóa → nút "Chỉnh sửa" xám mờ + nhãn *"Đang bị sửa bởi Ngô Minh Đức"* (chống Race Condition).
- **Cross-Version Comparison Selection:** trong Tab 3, tick 2 checkbox ở 2 phiên bản → Floating Action Bar trượt lên: *"So sánh hai phiên bản đã chọn (v5.0 vs v1.0)"* → dẫn sang màn hình Diff Engine (FR-3.3.1).

## 3. Component Frontend
```
src/
├── pages/documents/DocumentDetailPage.tsx         # Trang tổng quan tài liệu chi tiết
├── widgets/document-tabs/
│   ├── DocumentPreviewTab.tsx                      # Nội dung trực quan (PDF/Markdown)
│   ├── DocumentMetadataTab.tsx                     # Thuộc tính bảo mật ABAC
│   └── VersionTimelineTab.tsx                       # Dòng thời gian các phiên bản
└── features/document-lock/api/lock.api.ts          # API kích hoạt/giải phóng khóa tài liệu
```

## 4. Backend API
### `GET /api/v1/documents/:docId`
Response (200 OK):
```json
{
  "id": "doc-uuid",
  "title": "SRS_Core_Banking.pdf",
  "status": "RELEASED",
  "securityLevel": "INTERNAL",
  "lockedBy": null,
  "versions": [
    { "id": "ver-uuid-2", "versionNo": 2, "commitMessage": "Fix lỗi logic", "uploadedBy": "Ngô Minh Đức", "createdAt": "2026-05-22" },
    { "id": "ver-uuid-1", "versionNo": 1, "commitMessage": "Bản khởi tạo", "uploadedBy": "Nguyễn Văn A", "createdAt": "2026-05-20" }
  ]
}
```

### `POST /api/v1/documents/:docId/versions/:versionId/restore`
Response (201 Created): `{ "newVersionId": "ver-uuid-3", "versionNo": 3, "message": "Đã khôi phục thành công nội dung từ phiên bản cũ. Hệ thống đã sinh ra phiên bản v3.0." }`

### `GET /api/v1/documents/:docId/versions/:versionId/download`
Response (200 OK):
```json
{ "downloadUrl": "https://minio.local/vdt-docs/projects/.../file_v2.pdf?X-Amz-Signature=...", "expiresIn": 300, "message": "Link tải xuống có hiệu lực trong 5 phút." }
```

## 5. Under the Hood
- **Database Optimization with Join Queries:** chống N+1 Query khi lấy lịch sử phiên bản — Eager Loading lồng nhau trong một câu lệnh:
```typescript
this.prisma.documents.findUnique({
  where: { id: docId },
  include: {
    document_versions: { orderBy: { version_no: 'desc' }, include: { profiles: { select: { full_name: true } } } },
    project: { select: { status: true } }
  }
});
```
- **Strict State Gatekeeper Middleware:** trước khi trả Preview, Middleware bóc tách `status`. Nếu `DRAFT` mà người yêu cầu không phải chủ sở hữu hoặc PM → 403 (FR-2.3.2).
- **Append-Only Versioning (Rollback):** không `UPDATE` ghi đè. Khi restore, lấy `storage_key` + `raw_text_storage_key` của bản cũ, copy thành file vật lý mới trên MinIO, `INSERT` dòng mới trong `document_versions` với `version_no` cao nhất (v3.0) → bảo toàn dấu vết (Non-repudiation, FR-3.1.3).
- **Zero-Trust ABAC Gate (Download):** Guard hỏi Casbin: user có quyền DOWNLOAD với mức mật này trong bối cảnh (giờ giấc, IP) hiện tại không?
- **Không bao giờ trả link gốc cho Client:** với `security_level = CONFIDENTIAL`, API không trả URL MinIO.
- **Backend Proxy & On-the-fly Watermark:** Client gọi `GET /documents/:docId/stream`; NestJS kéo stream PDF từ MinIO về RAM, dùng `pdf-lib` chèn Watermark cứng (Email user + IP + Timestamp) lên từng trang, đẩy Binary đã đóng dấu về FE. Dù kẻ gian tải được, file đã in chết tên kẻ đó.
- **Mandatory Audit Trail:** bất kể ALLOW/DENY, hành động băm chuỗi ghi `audit_logs` với action `DOWNLOAD_SUCCESS`/`DOWNLOAD_DENIED`.
- **Anomaly Detection (FR-5.3.1):** dùng Redis Sorted Set (ZSET) làm Sliding Window — mỗi lần tải: `ZADD user:download_freq:<userId> <timestamp> <docId>`, dùng `ZREMRANGEBYSCORE` xóa bản ghi cũ hơn 1 phút, `ZCARD` đếm. Nếu `ZCARD > 10`:
  1. Từ chối Download → `429 Too Many Requests`.
  2. Bắn event `ANOMALY_DETECTED` qua Redis Pub/Sub hoặc Socket.
  3. Ghi log đỏ `SECURITY_ALERT` vào `audit_logs` → UI Admin ở Tamper Hub "nảy" cảnh báo real-time.
- **Lock release on upload:** trong Transaction upload version mới, ngay sau khi lưu thành công, gọi xóa Key khóa Redis (hoặc `locked_by = null`). Upload thành công = hoàn tất phiên làm việc.
