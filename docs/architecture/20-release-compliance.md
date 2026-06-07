# Luồng 20 — Bảng kiểm tuân thủ (Compliance Checklist)

- **Route:** `/projects/:projectId/releases/:releaseId`
- **Component:** Compliance Checklist
- **Actor:** PM / Admin
- **Module:** `modules/releases` (compliance.controller — engine chấm điểm tuân thủ & nén Export)

## 1. Layout
Split asymmetric master-detail layout:
- *Cột trái (Master Compliance List — 60%):* cây checklist các hạng mục tài liệu bắt buộc theo quy chuẩn (VD: SRS, System Design, API Spec). Cạnh mỗi hạng mục hiển thị file thực tế được hệ thống tự quét và map tương ứng kèm trạng thái phê duyệt.
- *Cột phải (Compliance Summary Panel — 40%):* thẻ tổng hợp kết quả + nút tối cao toàn chiều rộng: **Xuất Hồ Sơ Quy Chuẩn (Export Consolidated Package)**. Nút xám mờ (disabled) nếu phát hiện lỗi vi phạm.

## 2. UX States
- **Automated Linting Run State:** mở màn hình → tự chạy Compliance Engine. Icon vòng tròn xoay → tích xanh (Pass) nếu tài liệu `RELEASED`, hoặc chữ thập đỏ (Fail) nếu tài liệu cốt lõi còn `DRAFT`/`UNDER_REVIEW`.
- **Dynamic Vulnerability Alerts:** nếu VIOLATED, cột phải hiện hộp đỏ liệt kê lỗi: *"Lỗi nghiêm trọng: Tài liệu API Spec hiện tại thuộc thư mục 03_API_Spec đang ở trạng thái DRAFT. Quy trình nghiêm cấm release sản phẩm khi tài liệu kỹ thuật chưa được ký duyệt ban hành."*
- **Secure Export Overlay Progress:** bấm Export (chỉ mở khi tuân thủ 100%) → overlay: *"Hệ thống đang tiến hành nén tệp tin, ký số mã hóa dữ liệu và nhúng mã định danh kiểm toán..."* + thanh tiến trình %.

## 3. Component Frontend
```
src/
├── pages/releases/ComplianceChecklistPage.tsx     # Trang quét tuân thủ quy trình hồ sơ
├── widgets/compliance-checker/
│   ├── ChecklistItemTree.tsx                       # Cây hạng mục tài liệu bắt buộc đối chiếu
│   └── ExportActionControl.tsx                      # Bảng tổng hợp & nút kết xuất tối cao
└── features/compliance-linting/
    ├── utils/pdf-watermark-injector.ts            # Vẽ đè mờ watermark khi preview (FE)
    └── api/compliance-engine.api.ts                # API thẩm định & tải gói hồ sơ nén
```

## 4. Backend API
### `GET /api/v1/projects/:projectId/releases/:releaseId/compliance`
Response (200 OK):
```json
{
  "releaseId": "rel-uuid-001",
  "templateApplied": "SOFTWARE_GOVERNMENT_STANDARD",
  "isCompliant": false,
  "summary": { "totalRequired": 3, "passed": 2, "failed": 1 },
  "checklist": [
    { "requiredCategory": "SRS", "mappedDocument": "SRS_Core_v2.pdf", "docStatus": "RELEASED", "compliant": true },
    { "requiredCategory": "API_Spec", "mappedDocument": "API_Gate_v1.pdf", "docStatus": "DRAFT", "compliant": false }
  ]
}
```

### `POST /api/v1/projects/:projectId/releases/:releaseId/export`
Response (200 OK — File Stream): trả file `.zip` chứa toàn bộ hồ sơ đã đóng gói an toàn hoặc file báo cáo kiểm toán có mã xác thực.

## 5. Under the Hood
- **Automated Mapping Engine:** khi chạy Linting, thuật toán đối chiếu thư mục gốc. Nếu Template yêu cầu thư mục `01_SRS`, hệ thống query trong Snapshot `release_document_versions` xem có file nào `parent_id` là `01_SRS` không.
- **BullMQ Zip Archiver:** tải hàng chục PDF từ MinIO nén ZIP trên API sẽ chết RAM Node.js → đẩy cho Worker. Worker kéo file từ MinIO dạng Stream, dùng `archiver` đẩy thẳng stream thành `.zip` ném ngược lên MinIO, trình duyệt chỉ lấy link tải.
- **Audit Trail Stamp:** mọi thao tác Export ghi log: ai tải gói, lúc nào, IP gì — phục vụ truy vết lộ lọt.
