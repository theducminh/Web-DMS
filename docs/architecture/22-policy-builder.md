# Luồng 22 — Trình xây dựng luật trực quan (Visual Rule Builder)

- **Route:** `/admin/policies/builder`
- **Component:** Visual Rule Builder
- **Actor:** Admin / Security Officer
- **Yêu cầu nguồn:** FR-4.1.1, FR-4.1.2, FR-4.1.3

## 1. Layout
Rule Query Builder Layout trực quan hóa các luật ABAC phức tạp thành khối điều kiện:
- *Rule Canvas (bên trái):* dòng điều kiện logic liên tiếp (And/Or). Chọn thành phần từ 4 nhóm thuộc tính cốt lõi:
  - Subject (User: Phòng ban, Chức vụ)
  - Object (Tài liệu: Mức độ mật, Trạng thái)
  - Action (VIEW, DOWNLOAD, EDIT)
  - Context (Ngữ cảnh: Giờ hành chính, Dải IP nội bộ)
- *Khu vực xem trước & Thực thi (bên phải):* hiển thị cấu trúc JSON sinh tự động real-time theo giao diện kéo chọn, kèm nút "Áp dụng Luật lên Hệ thống".

## 2. UX States
- **Combinator Logic Toggle:** nút chuyển nhanh giữa AND/OR giữa các khối điều kiện, tự đổi màu sắc khối để phân biệt ranh giới nhóm.
- **Deadlock Auto-Validation (chống xung đột luật):** kiểm tra xung đột tĩnh ở Client. Nếu luật tự mâu thuẫn (VD: `IF [User.Dept == QA] ALLOW` nhưng dòng dưới `IF [User.Dept == QA] DENY`) → ô điều kiện nhấp nháy đỏ: *"Luật cấu hình bị trùng lặp hoặc xung đột với chính sách mặc định Default Deny"*.
- **Schema Dynamic Loading:** chọn trường thuộc tính (VD: Phòng ban) → Dropdown giá trị tiếp theo tự gọi API lấy danh sách thực từ bảng `departments`, tránh nhập tay sai chính tả.

## 3. Component Frontend
```
src/
├── pages/admin/PolicyBuilderPage.tsx              # Trang không gian xây dựng luật ABAC
├── widgets/policy-builder/
│   ├── RuleConditionCanvas.tsx                     # Khung chứa các hàng điều kiện logic động
│   └── PolicyJsonPreview.tsx                        # Khối hiển thị mã JSON & nút đồng bộ enforcer
└── features/rule-generation/
    ├── model/rule-builder.schema.ts               # Schema validate cấu trúc luật trực quan (Zod)
    └── api/policy-admin.api.ts                      # API lưu & kích hoạt luật Casbin
```

## 4. Backend API
### `POST /api/v1/admin/policies`
Payload:
```json
{
  "ptype": "p",
  "subjectCondition": "r.sub.department == 'Security' || r.sub.title == 'Project Manager'",
  "objectCondition": "r.obj.securityLevel == 'CONFIDENTIAL'",
  "action": "DOWNLOAD",
  "contextCondition": "r.ctx.hour >= 8 && r.ctx.hour <= 18"
}
```
Response (201 Created): `{ "ruleId": 42, "message": "Khởi tạo luật ABAC và cập nhật bộ máy Casbin thành công." }`

## 5. Under the Hood
- **Casbin Dynamic Policy Injection (FR-4.1.1, FR-4.1.3):** luật gửi lên được định dạng tương thích Node-Casbin, lưu vào bảng `casbin_rule` PostgreSQL. Ngay sau khi ghi thành công, gọi `await this.casbinEnforcer.loadPolicy()` để ép Casbin xóa cache cũ và nạp lại toàn bộ ma trận luật mới từ DB vào RAM ngay lập tức, không cần restart server.
- **Global Redis Cache Purge:** phát tín hiệu xóa sạch các key cache quyền cũ (TTL 5 phút của User) trên Redis để đồng bộ quyền lực tức thời toàn hệ thống.
