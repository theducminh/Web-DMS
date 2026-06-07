# Luồng 25 — Trung tâm phát hiện can thiệp (Tamper Detection Hub)

- **Route:** `/admin/security-alerts`
- **Component:** Tamper Detection Hub
- **Actor:** Admin / Security Officer
- **Yêu cầu nguồn:** FR-1.3.2 (Emergency Lockdown), FR-5.2 (Hash Chaining), US-5.2

## 1. Layout
Crisis Command Center Layout (bất đối xứng, tác động thị giác mạnh):
- *Hero Status Banner (trên cùng):* toàn chiều rộng. Mặc định xanh lục: `SYSTEM INTEGRITY SECURE`. Phát hiện can thiệp DB trái phép / rò rỉ dữ liệu → nhấp nháy đỏ rực: `INTEGRITY COMPROMISED - SECURITY ALERT` kèm âm thanh cảnh báo.
- *Lưới theo dõi sự cố (bên trái):* danh sách cảnh báo an ninh được quét tự động (VD: User tải >20 file mật trong 1 phút, phát hiện đứt gãy chuỗi Hash kiểm toán).
- *Bảng điều khiển tối cao (bên phải):* nút đỏ khổng lồ: **KÍCH HOẠT PHONG TỎA KHẨN CẤP (EMERGENCY LOCKDOWN)**.

## 2. UX States
- **High-Intensity Alert Pulse:** cảnh báo nghiêm trọng (đứt gãy Hash Chaining) có hiệu ứng viền phát sáng mạch xung đỏ; Admin phải click "Xác nhận đã xử lý sự cố" để tắt trạng thái khẩn cấp.
- **Emergency Lockdown Sequence:** chống click nhầm — click nút phong tỏa → Dialog che phủ toàn màn hình. Admin phải: nhập mã PIN an ninh cấp cao + nhập lý do phong tỏa + **giữ đè chuột** vào nút "Xác nhận kích hoạt" trong 3 giây (Hold-to-confirm) thì lệnh mới phát đi.

## 3. Component Frontend
```
src/
├── pages/admin/TamperDetectionHubPage.tsx         # Trang trung tâm điều hành an ninh
├── widgets/security-alerts/
│   ├── SystemIntegrityBanner.tsx                  # Biểu ngữ trạng thái an toàn toàn vẹn
│   ├── RealtimeAlertsList.tsx                     # Danh sách cảnh báo thời gian thực
│   └── LockdownControlPanel.tsx                    # Khối điều khiển nút đỏ phong tỏa
└── features/system-lockdown/
    ├── ui/LockdownVerifyModal.tsx                 # Modal nhập PIN & giữ đè xác nhận phong tỏa
    └── api/security-hub.api.ts                     # API kích hoạt phong tỏa & quét mã băm
```

## 4. Backend API
- `GET /api/v1/admin/security/verify-integrity`
  - Response (200 OK): `{ "status": "SECURE", "corruptedRowId": null, "message": "Kiểm tra toàn vẹn chuỗi Hash thành công. Không phát hiện dấu hiệu can thiệp dữ liệu trái phép." }`
- `POST /api/v1/admin/security/lockdown`
  - Payload: `{ "securityPin": "999999", "reason": "Phát hiện tài khoản nội bộ bị tấn công chiếm quyền và tải file mật quy mô lớn lúc nửa đêm." }`
  - Response (200 OK): `{ "status": "LOCKED", "message": "Hệ thống đã lập tức phong tỏa diện rộng. Toàn bộ phiên làm việc của nhân sự đã bị vô hiệu hóa." }`
- `POST /api/v1/admin/security/trigger-verify` → trả `202 Accepted` + `jobId` (quét chạy nền BullMQ).

## 5. Under the Hood
- **Hash Chaining Validation Algorithm (FR-5.2):** tiến trình quét ngầm định kỳ/thủ công duyệt `audit_logs` theo ID tăng dần: lấy dữ liệu Row hiện tại + `current_hash` của dòng trước (`previous_hash`) để tính lại SHA-256. Nếu DBA dùng quyền tối cao sửa lén một dòng giữa chuỗi → mã băm tính lại khác mã băm lưu trữ, chuỗi xích gãy tại dòng đó → kích hoạt cờ đỏ `INTEGRITY_COMPROMISED`.
- **Không chạy quét Log trên luồng API HTTP:** `POST /trigger-verify` chỉ trả `202 Accepted` + `jobId`. Quét đẩy xuống **BullMQ Worker** dùng Keyset Pagination (Cursor): lấy từng lô 1000 dòng, tính hash, kiểm tra, giải phóng RAM, lấy 1000 dòng tiếp. Frontend Polling (3s/lần) hoặc WebSocket nghe tiến độ ("Đang quét 45%...").
- **Emergency Lockdown Execution Mechanism:**
  1. Ghi cờ vào Redis: `Set system:lockdown = true`.
  2. Xóa sạch mọi khóa Token Session của tất cả user (trừ Admin phát lệnh từ dải IP an toàn) trên Redis → Force Logout khẩn cấp toàn hệ thống.
  3. `LockdownGuard` toàn cục đặt ở vị trí đầu tiên mọi Endpoint, liên tục check key `system:lockdown`. Nếu `true` → đánh chặn, trả `503 Service Unavailable` cho toàn bộ user → đưa hệ thống vào đóng băng bảo vệ.
  4. Lệnh Lockdown **không đá văng Session hiện tại của người bấm nút**, bất kể IP nào.
  5. Lệnh xóa Session Redis (`DEL user:sessions:*`) phải filter giữ lại đúng `sessionId` của Admin đang thực thi.
  6. Thêm API ngầm (Break-Glass) không nằm sau Guard Casbin, chỉ mở qua cổng nội bộ (SSH Tunnel / Secret Token tĩnh trong `.env`) để DevOps gỡ phong tỏa khi Admin mất quyền kiểm soát.
- Tham chiếu Guard: `core/guards/lockdown-503.guard.ts`.
