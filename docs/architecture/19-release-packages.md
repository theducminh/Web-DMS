# Luồng 19 — Gói phát hành (Release Packages)

- **Route:** `/projects/:projectId/releases`
- **Component:** Release Packages
- **Actor:** PM
- **Module:** `modules/releases` (releases.controller — khởi tạo gói, chốt Snapshot)

## 1. Layout
Hybrid List-Card Layout hiển thị tiến độ đóng gói hồ sơ phát hành:
- *Header:* tìm kiếm gói phát hành theo tên mã (VD: `Release_Sprint_1`, `Core_v2.0_ChinhThuc`), lọc theo trạng thái (VERIFIED, VIOLATED), nút "Khởi tạo đợt chốt hồ sơ" (chỉ PM).
- *Danh sách:* mỗi dòng: Tên mã đợt Release, Status Badge, Điểm tuân thủ (Compliance Score), Người khởi tạo, Mốc thời gian đóng băng (Frozen At).

## 2. UX States
- **Status Badge Visuals:** đạt chuẩn 100% → Badge xanh lục (VERIFIED). Phát hiện tài liệu dở dang (Draft/Under Review) → đỏ nhấp nháy (VIOLATED) + icon cảnh báo.
- **Creation Panel Sliding Drawer:** bấm "Khởi tạo đợt chốt hồ sơ" → Drawer trượt từ phải yêu cầu: Tên đợt phát hành, mốc thời gian đóng băng dữ liệu, chọn Template Checklist áp dụng.

## 3. Component Frontend
```
src/
├── pages/releases/ReleasePackagesPage.tsx         # Trang quản lý danh mục đợt đóng gói
├── widgets/release-list/
│   ├── ReleasePackageTable.tsx                     # Bảng danh sách đợt release
│   └── CreateReleaseDrawer.tsx                      # Drawer form khởi tạo gói chốt hồ sơ
└── features/compile-release-baseline/
    ├── model/release-form.schema.ts               # Zod Schema validate đầu vào
    └── api/release.api.ts                           # API CRUD khởi tạo gói
```

## 4. Backend API
- `GET /api/v1/projects/:projectId/releases` → danh sách phân trang các đợt Release kèm trạng thái.
- `POST /api/v1/projects/:projectId/releases`
  - Payload: `{ "releaseName": "Sprint_1_MVP", "templateType": "SOFTWARE_DEV", "description": "Chốt mốc kiểm thử Vòng 1" }`
  - Response:
```json
{ "id": "rel-uuid-001", "status": "PROCESSING", "message": "Đã ghi nhận lệnh chốt hồ sơ. Hệ thống đang tiến hành đóng băng và quét tuân thủ." }
```

## 5. Under the Hood
- **Immutable Pointer Snapshot (chụp nhanh bằng con trỏ DB):** không copy file vật lý. Chạy lệnh Prisma quét toàn bộ phiên bản tài liệu có `status = 'RELEASED'` và mới nhất tại đúng mili-giây đó, ghi ID các phiên bản vào bảng trung gian `release_document_versions`. Dù sau này tài liệu cập nhật lên v3.0, gói Release vĩnh viễn trỏ về v2.0.
- **BullMQ Async Compilation:** việc quét & Snapshot đẩy vào Background Job (BullMQ) để không treo luồng HTTP. Quét xong, job kích hoạt tiếp chu trình chấm điểm tuân thủ.
