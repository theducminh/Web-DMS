# Luồng 04 — Không gian làm việc (My Workspace / Dashboard)

- **Route:** `/dashboard`
- **Component:** My Workspace
- **Actor:** System User (mọi user đã đăng nhập)

## 1. Layout
Grid Layout chia 3 khu vực:
- *Cột trái/Trên cùng:* ô chỉ số thống kê nhanh (số dự án đang tham gia, số tài liệu mới cập nhật trong tuần).
- *Cột trung tâm:* widget "Tài liệu truy cập gần đây" (list) và "Dự án của tôi" (card).
- *Cột phải:* widget "Tài liệu đang chờ tôi duyệt" (Pending Approvals) dành cho cấp quản lý (PM/Reviewer).

## 2. UX States
- **Skeleton Loading:** hiệu ứng khung xương cho từng widget độc lập, tránh layout shift.
- **Role-Based Widget Visibility:** user không có quyền phê duyệt (Viewer/Intern) → ẩn hoàn toàn widget "Tài liệu đang chờ tôi duyệt".
- **Counter Badges:** badge đỏ số lượng cần duyệt, tự giảm khi xử lý xong. Dùng **Optimistic Update** của React Query (không cần WebSocket): khi PM Approve, giảm badge ngay trên UI, lỗi thì rollback; `refetchOnWindowFocus: true` tự đồng bộ khi quay lại tab.

## 3. Component Frontend
```
src/
├── pages/dashboard/DashboardPage.tsx              # Lắp ráp tổng thể các khối lưới
├── widgets/dashboard/
│   ├── RecentDocumentsWidget.tsx                  # Tài liệu mở gần đây
│   ├── MyProjectsWidget.tsx                       # Danh sách dự án tham gia
│   └── PendingApprovalsWidget.tsx                 # Tài liệu đợi duyệt (có logic check Role)
└── features/dashboard-analytics/
    ├── ui/StatCard.tsx                            # Thẻ con hiển thị con số thống kê
    └── api/dashboard.api.ts                       # Tổng hợp API lấy thông tin tổng quan
```

## 4. Backend API
### `GET /api/v1/dashboard/summary`
- Headers: `Authorization: Bearer <JWT_TOKEN>`
- Response (200 OK):
```json
{
  "assignedProjectsCount": 5,
  "pendingMyReviewCount": 2,
  "recentDocuments": [
    { "id": "doc-uuid-1", "title": "API Spec V2", "updatedAt": "2026-05-22T10:00:00Z" }
  ]
}
```

## 5. Under the Hood
- **Strict SQL Security Join:** chống Data Leak, truy vấn Prisma/SQL bắt buộc JOIN `projects` với `project_members` theo `user_id` bóc tách từ JWT. User chỉ thấy số liệu của các dự án họ được gán quyền trực tiếp.
- **Performance Optimization Cache:** số liệu Dashboard cache trên Redis với TTL ngắn (1–2 phút) để tránh Database Hammering khi nhiều nhân sự F5 cùng lúc.
