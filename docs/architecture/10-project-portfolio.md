# Luồng 10 — Danh mục dự án (Project Portfolio)

- **Route:** `/projects`
- **Component:** Project Portfolio
- **Actor:** System User / PM
- **Yêu cầu nguồn:** FR-2.1.1

## 1. Layout
Card Grid Layout:
- *Header:* thanh tìm kiếm nhanh, bộ lọc trạng thái (ACTIVE, ARCHIVED), nút "Tạo dự án mới" (ẩn/hiện tùy chức vụ).
- *Project Cards:* mỗi dự án là 1 thẻ: Tên (bôi đậm), tóm tắt mô tả, Badge trạng thái (Xanh: Active, Xám: Archived), PM Owner, và 2 chỉ số góc: số tài liệu, số thành viên.

## 2. UX States
- **Conditional Action Visibility:** nút "Tạo dự án mới" chỉ hiện khi `title` từ JWT là Project Manager hoặc Admin. Developer/QA/Intern không thấy.
- **Skeleton Grid Loading:** 6 card skeleton nhấp nháy trong lúc tải.
- **Empty State Handling:** chưa được gán dự án → ẩn lưới, hiện: *"Bạn chưa được gán vào dự án nào. Vui lòng liên hệ Quản trị dự án (PM) để được thêm vào không gian làm việc."*
- **Pinned Projects:** icon Ngôi sao (Star) ở góc phải mỗi card; tick vào → dự án luôn trồi lên đầu lưới (lưu ở bảng `user_project_preferences`, không ảnh hưởng người khác).

## 3. Component Frontend
```
src/
├── pages/projects/ProjectPortfolioPage.tsx        # Màn hình danh mục dự án tổng thể
├── widgets/project-grid/
│   ├── ProjectSearchBar.tsx                        # Tìm kiếm & lọc trạng thái
│   └── ProjectCardGrid.tsx                          # Lưới các thẻ dự án
└── features/browse-projects/
    ├── ui/ProjectCard.tsx                          # Thẻ dự án (metadata & chỉ số)
    └── api/projects.api.ts                          # API lấy danh sách dự án được quyền
```

## 4. Backend API
### `GET /api/v1/projects`
- Query: `page=1&limit=9&search=CoreBanking&status=ACTIVE`
- Response (200 OK):
```json
{
  "data": [
    {
      "id": "proj-uuid-001",
      "name": "Hệ thống Core Banking 2026",
      "description": "Nâng cấp hạ tầng giao dịch cốt lõi của tập đoàn",
      "status": "ACTIVE",
      "role": "PROJECT_MANAGER",
      "isStarred": true,
      "documentCount": 142,
      "memberCount": 18,
      "createdAt": "2026-01-10T00:00:00Z"
    }
  ],
  "meta": { "totalItems": 1, "totalPages": 1, "currentPage": 1 }
}
```

## 5. Under the Hood
- **Data Isolation Guard (cô lập dữ liệu tầng SQL):** không bao giờ `SELECT * FROM projects` bừa bãi. Truy vấn lồng qua bảng trung gian:
```typescript
this.prisma.projects.findMany({
  where: {
    OR: [
      { project_members: { some: { user_id: currentUser.id } } },
      { owner_id: currentUser.id }
      // Nếu currentUser.role === 'ADMIN' thì bỏ qua điều kiện lọc này
    ]
  },
  include: {
    _count: { select: { documents: true, project_members: true } },
    owner: { select: { full_name: true } }
  }
});
```
- **Casbin Verification Context:** khi bấm vào thẻ dự án cụ thể, gọi Casbin xác thực quyền truy cập cơ sở trước khi mở luồng tải thư mục bên trong.
