# Luồng 23 — Sổ cái nhật ký kiểm toán (Audit Ledger Dashboard)

- **Route:** `/admin/audit-logs`
- **Component:** Audit Ledger Dashboard
- **Actor:** Admin / Security Officer
- **Yêu cầu nguồn:** FR-5.1.1, FR-5.1.2, US-5.1

## 1. Layout
Enterprise Ledger Layout (mật độ thông tin cao):
- *Filter Bar (trên cùng):* lọc theo Thời gian (bắt đầu - kết thúc), `user_id`, IP máy khách, Loại hành động (LOGIN, ACCESS_DENIED, DOWNLOAD), Trạng thái (Thành công/Thất bại).
- *Main Ledger Table:* danh sách log phẳng. Dòng `ACCESS_DENIED` hoặc `is_success = false` được bôi màu nền đỏ nhạt để Security Officer thấy ngay.

## 2. UX States
- **Server-Side Cursor Pagination:** bảng `audit_logs` phình rất nhanh → dùng Cursor-based Pagination (hoặc số trang tĩnh có giới hạn), vô hiệu hóa nút nhảy trang vô định để tránh nghẽn DB.
- **Row Expansion for Payload Inspection:** click 1 dòng log → mở rộng (Expand) xổ xuống Fenced Code Block hiển thị chi tiết Payload, Before/After (tác vụ Admin), hoặc lý do từ chối chi tiết từ Casbin Engine.

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
### `GET /api/v1/admin/audit-logs`
- Query: `page=1&limit=50&action=ACCESS_DENIED&status=false`
- Response (200 OK):
```json
{
  "logs": [
    {
      "id": "10423",
      "timestamp": "2026-05-22T20:00:00Z",
      "userId": "user-uuid-888",
      "action": "ACCESS_DENIED",
      "targetId": "doc-uuid-999",
      "ipAddress": "10.22.44.55",
      "isSuccess": false,
      "failReason": "Casbin Deny: Outside business hours",
      "currentHash": "a1b2c3d4..."
    }
  ],
  "meta": { "hasMore": true, "nextCursor": "10373" }
}
```

## 5. Under the Hood
- Toàn bộ dữ liệu log ghi vào bảng `audit_logs` được cấu hình **Table Partitioning** trong PostgreSQL (chia theo tháng: `audit_logs_2026_04`, `audit_logs_2026_05`) để không bị chậm khi dung lượng phình.
- **Append-only / Tamper-proof (FR-5.2):** mỗi dòng log chứa `previous_hash` và `current_hash` (SHA-256). DB cấu hình quyền riêng cho Backend: chỉ INSERT, **không UPDATE/DELETE** (NFR-1.3). Sửa lén một dòng giữa chuỗi → gãy chuỗi hash phía sau.
- **Ghi log thất bại (FR-5.1.1):** bắt buộc ghi cả hành động bị từ chối (VD: User A cố truy cập File B nhưng bị ABAC từ chối ngoài giờ hành chính) — dữ liệu quan trọng cho đội SOC phân tích cảnh báo.
