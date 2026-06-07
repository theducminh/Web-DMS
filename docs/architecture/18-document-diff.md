# Luồng 18 — Công cụ so sánh khác biệt (Hybrid Visual Diff Engine)

- **Route:** `/documents/:docId/diff` (query: `?v1=old_id&v2=new_id`)
- **Component:** Hybrid Visual Diff Engine
- **Actor:** PM / Reviewer / Contributor
- **Yêu cầu nguồn:** FR-3.2.1, FR-3.3.1, US-3.1

## 1. Layout — Dual Split-View (2 cột kép tích hợp Toggle)
Tuyệt đối không dùng 3 cột (gây vỡ layout trên 1080p).
- **Toolbar:** 2 Dropdowns chọn tự do mốc phiên bản (VD: v1.0 vs v5.0) + nút **Swap** (đảo chiều). **Toggle Switch** trung tâm: *"Xem bản gốc (Original)"* ↔ *"Xem thay đổi (Text Diff)"*. Summary Widget hiển thị số dòng thêm (Additions - xanh) / xóa (Deletions - đỏ).
- **Chế độ Original:** chia đôi 2 cột hiển thị file nguyên bản (PDF Viewer/Docx Viewer), giữ nguyên hình thức/bảng biểu/layout để kiểm toán viên soi bằng mắt.
- **Chế độ Text Diff:** 2 cột văn bản; đoạn xóa nền đỏ (cột trái), đoạn thêm nền xanh (cột phải). Không load đoạn không đổi (giấu bằng nút `...`).

## 2. UX States
- **Synchronized Scrolling:** ở cả 2 chế độ, cuộn cột trái → cột phải cuộn theo cùng tỷ lệ %.
- **Async Processing Loader:** file PDF nặng mất vài giây → khi bấm "So sánh" hiện Loading mờ: *"Đang khởi động Engine phân tích khác biệt..."*.
- **Dynamic Validation:** tự động khóa Dropdown, không cho chọn v1 trùng v2.

## 3. Component Frontend
```
src/
├── pages/documents/DocumentDiffPage.tsx           # Trang gốc điều phối luồng Diff
├── widgets/diff-workspace/
│   ├── DiffToolbar.tsx                             # Thanh chọn version & Toggle Mode
│   ├── OriginalFileViewer.tsx                      # Render file gốc (PDF/Docx) qua iframe
│   └── DeltaDiffRenderer.tsx                       # Render Text Diff từ mảng Deltas
└── features/compute-hybrid-diff/
    ├── utils/scroll-sync-engine.ts                # Đồng bộ vị trí cuộn giữa 2 cột
    └── api/get-diff-data.api.ts                     # API nhận JSON chứa mảng Deltas
```

## 4. Backend API
### `GET /api/v1/documents/:docId/diff`
- Query: `v1=1&v2=5`
- Response (200 OK):
```json
{
  "documentId": "doc-uuid",
  "meta": { "v1": { "versionNo": 1, "author": "Nguyễn Văn A" }, "v2": { "versionNo": 5, "author": "Ngô Minh Đức" } },
  "originalUrls": {
    "v1Url": "https://minio.local/vdt-docs/file-v1.pdf?X-Amz-Signature=...",
    "v2Url": "https://minio.local/vdt-docs/file-v2.pdf?X-Amz-Signature=..."
  },
  "statistics": { "additions": 42, "deletions": 12 },
  "diffDeltas": [
    { "type": "unchanged", "count": 50, "value": "... [Văn bản không thay đổi] ..." },
    { "type": "removed", "value": "Hệ thống sử dụng MongoDB." },
    { "type": "added", "value": "Hệ thống sử dụng PostgreSQL để đảm bảo ACID." }
  ]
}
```
*(Lưu ý: không trả Raw Text vài MB, chỉ trả mảng `diffDeltas` đã được Binary băm sẵn.)*

## 5. Under the Hood — Kiến trúc tích hợp Binary
- **Không** dùng `child_process.exec()` gọi thẳng binary 100MB mỗi request (cold-start nặng, 10 người gọi cùng lúc nổ RAM/I/O Spike).
- **Microservice Wrapper:**
  1. Bọc Binary/Code Python bằng Framework siêu nhẹ (FastAPI/Flask) → biến thành **Diff Engine Microservice** chạy nền (Keep-alive) trên RAM, đóng gói container riêng (`diff-engine-container`).
  2. Khi `/diff` của NestJS được gọi, NestJS lấy 2 link nội bộ file gốc từ MinIO, gửi HTTP Request (hoặc gRPC) sang `diff-engine-container`.
  3. Service Python tải file về, dùng thư viện native PDF/Docx/MD, chạy thuật toán tính khác biệt, xuất JSON mảng Deltas (chỉ chứa dòng bị đổi) trả về NestJS.
- **Delta Payload Optimization:** trình duyệt không phải tính Myers Diff (tốn CPU máy trạm), chỉ nhận vài chục KB JSON `diffDeltas` để in ra → siêu mượt dù file 500 trang.
- **Double-Gate Casbin Guard:** user phải vượt ABAC của **cả hai** phiên bản. Nếu một bản là `CONFIDENTIAL` mà user không đủ thẩm quyền → 403, khóa hành vi "xem lén" lịch sử tài liệu.
