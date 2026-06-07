# Luồng 21 — Quản lý chính sách ABAC (ABAC Policy Manager)

- **Route:** `/admin/policies`
- **Component:** ABAC Policy Manager
- **Actor:** Admin / Security Officer
- **Yêu cầu nguồn:** FR-4.1.1, FR-4.1.3, FR-4.2.1

## 1. Layout
Split Workspace kết hợp kiểm thử:
- *Bên trái (Policy Data Grid):* danh sách luật ABAC hiện hành nạp từ DB. Cột theo định dạng Casbin: Subject (Vai trò/Chức vụ), Resource (URI/Tài nguyên), Action (VIEW, EDIT...), Effect (ALLOW/DENY), Condition (điều kiện biên ABAC).
- *Bên phải (Visual Policy Builder & Simulator):*
  - Trên: Card nút "Đi đến Trình xây dựng luật nâng cao (Visual Builder)" → `/admin/policies/builder`.
  - Dưới (Tab Policy Simulator): biểu mẫu nhập thử nghiệm User ID, Document ID, Action. Bấm "Kiểm tra quyền" → chạy dry-run báo kết quả trực quan.

## 2. UX States
- **Simulator Visual Feedback:** kết quả DENY → Alert đỏ chói + mã lỗi; dòng luật gây từ chối ở bảng trái được **highlight (viền đỏ nhấp nháy)** để Admin biết luật nào đang chặn.
- **Lockdown State (luật hệ thống bất biến):** luật cốt lõi (Admin có mọi quyền, tài liệu ARCHIVED không sửa được) hiển thị icon ổ khóa xám, ẩn nút Xóa/Sửa để tránh làm sập hệ thống bảo mật.

## 3. Component Frontend
```
src/
├── pages/admin/AbacPolicyManagerPage.tsx          # Màn hình tổng quan quản trị & giả lập quyền
├── widgets/policy-manager/
│   ├── PolicyDataGrid.tsx                          # Bảng danh sách p-rule và g-rule
│   └── PolicySimulatorPanel.tsx                     # Khối nhập dữ liệu giả lập dry-run
└── features/policy-simulation/
    ├── utils/casbin-syntax-parser.ts              # Dịch cú pháp Casbin thô sang tiếng Việt trực quan
    └── api/policy-manager.api.ts                    # API kéo danh sách luật & gửi request thử nghiệm
```

## 4. Backend API
- `GET /api/v1/admin/policies` → mảng danh sách các luật đang lưu DB.
- `POST /api/v1/admin/policies/simulate` (API giả lập dry-run)
  - Payload: `{ "userId": "user-uuid-123", "documentId": "doc-uuid-456", "action": "DOWNLOAD" }`
  - Response:
```json
{ "isAllowed": false, "matchedRuleId": "policy-rule-88", "reason": "Yêu cầu cấp độ bảo mật CONFIDENTIAL nhưng tài khoản người dùng đang ở mức INTERNAL." }
```

## 5. Under the Hood
- **Isolated Memory Enforcer Dry-Run:** API `/simulate` không chạy trên Enforcer chính đang chịu tải Production. Hệ thống khởi tạo Casbin Enforcer ảo độc lập trong bộ nhớ (Sandboxed Instance), nạp tập luật hiện hành + truyền claims giả lập → an toàn tuyệt đối, không rò rỉ quyền / nghẽn luồng thực tế.
- **Supabase Prisma Casbin Adapter:** toàn bộ luật lưu vật lý tại bảng `casbin_rule` của PostgreSQL qua Prisma Adapter, thay vì file `.csv` tĩnh cục bộ.
