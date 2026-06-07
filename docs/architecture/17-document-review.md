# Luồng 17 — Quy trình phê duyệt (Approval Workflow)

- **Route:** `/documents/:docId/review`
- **Component:** Approval Workflow
- **Actor:** PM / Reviewer
- **Yêu cầu nguồn:** FR-2.3.1
- **Module:** `modules/workflow` (review.controller — Approve/Reject & FSM)

## 1. Layout
Split Screen Layout dành cho cấp quản lý phê duyệt:
- *Nửa trái:* trình đọc văn bản hiển thị nội dung phiên bản mới nhất cần thẩm định.
- *Nửa phải:* Approval Control Panel — thông tin người nộp, lý do cập nhật, lịch sử phê duyệt trước, ô nhập lớn "Ý kiến phản hồi / Lý do từ chối". Dưới cùng 2 nút lớn: **Approve** (xanh lá), **Reject** (đỏ).

## 2. UX States
- **Strict Validation on Rejection:** Approve có thể để trống ý kiến. Reject → chặn lại, viền đỏ ô nhập + lỗi: *"Bắt buộc phải nhập lý do từ chối để Contributor biết chính xác nghiệp vụ sai sót cần sửa đổi"*. Nút "Xác nhận từ chối" chỉ mở khi ô nhập > 10 ký tự.
- **Action Block Out Loading:** bấm nút quyết định → Overlay loader phủ toàn màn hình, vô hiệu hóa click tiếp theo (chống gửi trùng lệnh do trễ mạng).

## 3. Component Frontend
```
src/
├── pages/review-workflow/DocumentReviewPage.tsx   # Trang thẩm định & duyệt tài liệu
├── widgets/review-panel/
│   ├── DocumentContentSidebar.tsx                 # Tài liệu cần duyệt (bên trái)
│   └── DecisionMakerPanel.tsx                      # Form ý kiến + cặp nút Approve/Reject
└── features/submit-review-decision/
    ├── model/review.schema.ts                     # Schema kiểm tra lý do phê duyệt
    └── api/review.api.ts                            # Gửi quyết định duyệt lên NestJS
```

## 4. Backend API
### `POST /api/v1/documents/:docId/review`
- Payload: `{ "action": "REJECT", "comment": "Tài liệu thiết kế API thiếu trường mã hóa OTP ở luồng thanh toán chính." }`
- Response (200 OK): `{ "newStatus": "DRAFT", "message": "Đã từ chối phê duyệt tài liệu và chuyển về trạng thái Draft." }`

## 5. Under the Hood
- **Finite State Machine & Lock Release:** áp dụng FSM, chỉ xử lý nếu trạng thái gốc là `UNDER_REVIEW`.
  - APPROVE → `RELEASED`: phiên bản hiện tại chính thức là bản chuẩn (SSOT) cho Dev/QA.
  - REJECT → quay về `DRAFT`, đồng thời giải phóng `locked_by = null` để mở quyền sửa cho Contributor.
- **Cache Eviction & Non-repudiation Logging:** xóa cache quyền trên Redis để cập nhật ma trận ABAC cho tệp ngay; toàn bộ chuỗi sự kiện (gồm nội dung phản hồi) định dạng JSON, chạy SHA-256 xích dòng log trước (Hash Chaining) rồi `INSERT-only` vào PostgreSQL.
- **Event-Driven Notification:** ngay khi transaction Approve/Reject thành công, đẩy job vào BullMQ:
```typescript
await this.emailQueue.add('sendReviewResult', {
  to: document.author.email,
  documentTitle: document.title,
  decision: 'REJECTED',
  reason: comment,
  reviewerName: currentUser.fullName
});
```
  Worker ở container độc lập tiêu thụ job, render template HTML và gửi email cho tác giả mà không làm nghẽn API phê duyệt.
