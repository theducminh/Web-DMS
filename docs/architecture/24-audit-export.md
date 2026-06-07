# Luồng 24 — Kết xuất tuân thủ (Compliance Export)

- **Route:** `/admin/audit-logs/export`
- **Component:** Compliance Export
- **Actor:** Admin / Security Officer
- **Yêu cầu nguồn:** FR-5.3.2

## 1. Layout
Enterprise Ledger Layout (đồng bộ với Audit Ledger):
- *Filter Bar (trên cùng):* lọc theo Thời gian (bắt đầu - kết thúc), `user_id`, IP máy khách, Loại hành động (LOGIN, ACCESS_DENIED, DOWNLOAD), Trạng thái.
- *Main Ledger Table:* danh sách log phẳng, dòng `ACCESS_DENIED` / `is_success = false` bôi nền đỏ nhạt.
- Màn hình cấu hình kết xuất: chọn khoảng thời gian để tải về file PDF/CSV phục vụ thanh tra.

## 2. UX States
- **Server-Side Cursor Pagination:** Cursor-based Pagination để tránh nghẽn DB khi dữ liệu hàng triệu dòng.
- **Row Expansion for Payload Inspection:** click dòng log → mở rộng Fenced Code Block hiển thị Payload, Before/After, hoặc lý do từ chối từ Casbin.

## 3. Component Frontend
```
src/
├── pages/admin/AuditLedgerPage.tsx                # Trang trung tâm giám sát nhật ký sổ cái
├── widgets/audit-ledger/
│   ├── AdvancedFilterPanel.tsx                     # Thanh cấu hình bộ lọc chuyên sâu
│   └── LedgerExpandedTable.tsx                      # Bảng log tích hợp mở rộng dòng
└── features/audit-stream/api/audit-query.api.ts    # API truy vấn log kèm phân trang
```

## 4. Backend API
### `POST /api/v1/admin/audit-logs/export`
- Payload: `{ "startTime": "2026-05-01T00:00:00Z", "endTime": "2026-05-22T23:59:59Z", "format": "PDF", "scope": "SECURITY_ONLY" }`
- Response (200 OK — File Stream): trả luồng nhị phân (`application/pdf` hoặc `text/csv`) trực tiếp qua kết nối mạng.

## 5. Under the Hood
- **Server-Side Data Streaming (tránh tràn RAM):** tuyệt đối không tải toàn bộ hàng vạn bản ghi log vào RAM để tạo file (gây OOM). Dùng Database Cursor/Stream của PostgreSQL + thư viện `csv-write-stream`. Dữ liệu đọc đến đâu Transform thành định dạng tệp và đẩy thẳng ra Writable HTTP Response Stream đến đó, giữ RAM ổn định < 20MB.
- **Cryptographic Watermarking & Signing:** với PDF, nhúng Watermark chìm ghi định danh Admin thực hiện lệnh xuất + IP vào từng trang. Cuối tệp, Backend tính SHA-256 ký số toàn bộ nội dung kèm Secret Key hệ thống → Digital Signature Footer phục vụ đối chiếu, ngăn chỉnh sửa thủ công nội dung báo cáo sau khi tải về.
- File PDF xuất ra có đóng dấu watermark ngày giờ trích xuất (FR-5.3.2).
