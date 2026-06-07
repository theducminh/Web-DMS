# Kiến trúc hệ thống — VDT Zero-Trust Document Management System (DMS)

Tài liệu này bóc tách thiết kế nghiệp vụ & kỹ thuật chi tiết của hệ thống **Quản lý Tài liệu Dự án theo mô hình Zero-Trust** thành các luồng (Luồng/Flow) riêng biệt, mỗi file mô tả một màn hình/route theo 5 phần: **Layout → UX States → Component Frontend → Backend API → Under the Hood**.

> Nguồn: `Phân tích nghiệp vụ, thiết kế kĩ thuật.docx.md`. Tài liệu gồm **25 luồng nghiệp vụ cốt lõi** (Luồng 1–25) cộng thêm **1 luồng mở rộng** (Luồng 26 — bonus).

## Tổng quan hệ thống

- **Mục tiêu:** Single Source of Truth (SSOT) cho tài liệu dự án, bảo mật chuẩn Enterprise (Zero Trust / ABAC + SSE), cải tiến quy trình release.
- **Vòng đời tài liệu:** `DRAFT → UNDER_REVIEW → RELEASED → ARCHIVED`.
- **Kiến trúc:** Modular Monolith trên NestJS (Client-Server, hướng Event-Driven), 4 lớp: Client (React SPA) → Nginx (TLS 1.3) → NestJS (Core Modules + BullMQ Workers) → Data (PostgreSQL, Redis, MinIO).

### Tech Stack
| Lớp | Công nghệ |
| --- | --- |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL (Supabase) — Table Partitioning, JSONB |
| Storage | MinIO (S3 API, SSE-S3 AES-256, Object Lock/WORM) |
| Policy Engine | Node-Casbin (ABAC, Prisma Adapter → bảng `casbin_rule`) |
| Cache & Queue | Redis + BullMQ |
| Frontend | React + Vite + Tailwind CSS + react-diff-viewer (Feature-Sliced Design) |

### Mô hình dữ liệu (tóm tắt)
`departments`, `profiles`, `casbin_rule`, `projects`, `project_members`, `folders`, `documents` (Pessimistic Locking qua `locked_by`), `document_versions`, `audit_logs` (Hash Chaining + Table Partitioning, INSERT-only), `project_templates`, `template_folders`.

## Mục lục các luồng nghiệp vụ

### Nhóm 1 — Xác thực & Hồ sơ (Identity Access Management)
| # | Luồng | Route | Actor |
| --- | --- | --- | --- |
| 01 | [Đăng nhập hợp nhất](01-auth-login.md) | `/auth/login` | Guest |
| 02 | [Đăng ký nhân viên](02-auth-register.md) | `/auth/register` | Guest |
| 03 | [Khôi phục mật khẩu](03-auth-forgot-password.md) | `/auth/forgot-password` | Guest |
| 04 | [Không gian làm việc (Dashboard)](04-dashboard.md) | `/dashboard` | System User |
| 05 | [Hồ sơ cá nhân](05-profile.md) | `/profile` | System User |
| 06 | [An toàn tài khoản](06-profile-security.md) | `/profile/security` | System User |

### Nhóm 2 — Quản trị IAM (Admin / Security Officer)
| # | Luồng | Route | Actor |
| --- | --- | --- | --- |
| 07 | [Danh bạ người dùng](07-admin-user-directory.md) | `/admin/users` | Admin |
| 08 | [Gán thuộc tính ABAC](08-admin-attribute-assignment.md) | `/admin/users/:userId/attributes` | Admin |
| 09 | [Danh mục phòng ban](09-admin-departments.md) | `/admin/departments` | Admin |

### Nhóm 3 — Dự án & Thư mục (Workspace & Project)
| # | Luồng | Route | Actor |
| --- | --- | --- | --- |
| 10 | [Danh mục dự án](10-project-portfolio.md) | `/projects` | System User / PM |
| 11 | [Khởi tạo dự án](11-project-create.md) | `/projects/create` | PM / Admin |
| 12 | [Trình duyệt thư mục](12-folder-navigator.md) | `/projects/:projectId/folders/:folderId` | Contributor / PM |
| 13 | [Quản trị nhân sự dự án](13-project-team.md) | `/projects/:projectId/team` | PM |
| 14 | [Cấu hình dự án](14-project-settings.md) | `/projects/:projectId/settings` | PM |

### Nhóm 4 — Tài liệu, Phiên bản & Diff (Document Control)
| # | Luồng | Route | Actor |
| --- | --- | --- | --- |
| 15 | [Tải lên tài liệu](15-document-upload.md) | `/projects/:projectId/documents/upload` | Contributor / PM |
| 16 | [Bảng điều khiển tài liệu](16-document-detail.md) | `/documents/:docId/detail` | System User / PM |
| 17 | [Quy trình phê duyệt](17-document-review.md) | `/documents/:docId/review` | PM / Reviewer |
| 18 | [Công cụ so sánh khác biệt (Diff)](18-document-diff.md) | `/documents/:docId/diff` | PM / Reviewer |
| 19 | [Gói phát hành (Release)](19-release-packages.md) | `/projects/:projectId/releases` | PM |
| 20 | [Bảng kiểm tuân thủ](20-release-compliance.md) | `/projects/:projectId/releases/:releaseId` | PM / Admin |

### Nhóm 5 — Chính sách & Kiểm toán (Security & Compliance)
| # | Luồng | Route | Actor |
| --- | --- | --- | --- |
| 21 | [Quản lý chính sách ABAC](21-abac-policy-manager.md) | `/admin/policies` | Admin |
| 22 | [Trình xây dựng luật trực quan](22-policy-builder.md) | `/admin/policies/builder` | Admin |
| 23 | [Sổ cái nhật ký kiểm toán](23-audit-ledger.md) | `/admin/audit-logs` | Admin |
| 24 | [Kết xuất tuân thủ](24-audit-export.md) | `/admin/audit-logs/export` | Admin |
| 25 | [Trung tâm phát hiện can thiệp](25-security-alerts.md) | `/admin/security-alerts` | Admin |

### Bonus — Master Data
| # | Luồng | Route | Actor |
| --- | --- | --- | --- |
| 26 | [Danh mục mẫu dự án](26-project-templates.md) | `/admin/project-templates` | Admin |
