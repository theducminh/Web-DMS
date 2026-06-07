/* eslint-disable @typescript-eslint/no-var-requires */
// VDT DMS — Báo cáo Word ~40 trang qua docx-js.
// Chạy: node build-report.js  → ./BaoCao_VDT_DMS.docx
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  TableOfContents, BorderStyle, WidthType, ShadingType, PageNumber,
  PageBreak, TabStopType, TabStopPosition, PositionalTab,
  PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader,
} = require('docx');

// ============================================================================
// Helpers
// ============================================================================
const FONT = 'Times New Roman';
const PAGE_WIDTH = 11906;   // A4
const PAGE_HEIGHT = 16838;
const MARGIN = 1440;        // 1 inch
const CONTENT_W = PAGE_WIDTH - 2 * MARGIN; // ≈ 9026

const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const allBorders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120, line: 320 },
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, font: FONT, size: opts.size ?? 24, bold: opts.bold, italics: opts.italic, color: opts.color })],
  });
}
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 480, after: 240 },
    children: [new TextRun({ text, font: FONT, size: 36, bold: true, color: '004D40' })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, font: FONT, size: 30, bold: true, color: '00695C' })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: '00796B' })],
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { after: 80, line: 300 },
    children: [new TextRun({ text, font: FONT, size: 24 })],
  });
}
function code(text) {
  return new Paragraph({
    spacing: { before: 60, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
    children: [new TextRun({ text, font: 'Consolas', size: 20, color: '263238' })],
  });
}
function emptyLine() { return new Paragraph({ children: [new TextRun({ text: '' })] }); }

function cell(text, opts = {}) {
  return new TableCell({
    borders: allBorders,
    width: { size: opts.width ?? Math.floor(CONTENT_W / 4), type: WidthType.DXA },
    shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text, font: FONT, size: 22, bold: opts.bold, color: opts.color })],
      }),
    ],
  });
}

function table(rows, columnWidths) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths,
    rows: rows.map((row, i) => new TableRow({
      tableHeader: i === 0,
      children: row.map((c, ci) =>
        cell(c, { width: columnWidths[ci], bold: i === 0, bg: i === 0 ? '00796B' : undefined, color: i === 0 ? 'FFFFFF' : undefined }),
      ),
    })),
  });
}

// ============================================================================
// COVER PAGE
// ============================================================================
const cover = [
  new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'VIETTEL DIGITAL TALENT 2026', font: FONT, size: 28, bold: true, color: 'E60012' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 },
    children: [new TextRun({ text: 'CAPSTONE PROJECT REPORT', font: FONT, size: 24, italics: true, color: '666666' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: 'VDT ZERO-TRUST', font: FONT, size: 52, bold: true, color: '004D40' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 },
    children: [new TextRun({ text: 'DOCUMENT MANAGEMENT SYSTEM', font: FONT, size: 40, bold: true, color: '004D40' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: 'Hệ thống Quản lý Tài liệu Dự án theo mô hình Zero-Trust', font: FONT, size: 28, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600, before: 1200 },
    children: [new TextRun({ text: 'BÁO CÁO PHÂN TÍCH NGHIỆP VỤ & THIẾT KẾ HỆ THỐNG', font: FONT, size: 26, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: 'Phiên bản: 1.0', font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: 'Ngày: 06/2026', font: FONT, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 },
    children: [new TextRun({ text: 'Hà Nội — 2026', font: FONT, size: 24, italics: true })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================
const toc = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: 'MỤC LỤC', font: FONT, size: 36, bold: true })] }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ============================================================================
// CHƯƠNG 1 — PHÂN TÍCH NGHIỆP VỤ (~8 trang)
// ============================================================================
const chapter1 = [
  h1('CHƯƠNG 1. PHÂN TÍCH NGHIỆP VỤ'),

  h2('1.1. Bối cảnh và vấn đề'),
  p('Trong bối cảnh chuyển đổi số mạnh mẽ tại Tập đoàn Công nghiệp – Viễn thông Quân đội Viettel, việc quản lý tài liệu kỹ thuật của các dự án phần mềm và hạ tầng trở thành thách thức trọng yếu. Mỗi dự án có thể sinh ra hàng nghìn tài liệu kỹ thuật (SRS, Thiết kế, API Spec, Test Plan, Release Notes…) với chu trình biên tập – phê duyệt – phát hành lặp đi lặp lại nhiều vòng. Việc lưu trữ tài liệu trên nhiều nền tảng khác nhau (file share, email, Google Drive cá nhân, công cụ chat) gây ra ba vấn đề nghiêm trọng:'),
  bullet('Mất Single Source of Truth (SSOT): một phiên bản tài liệu được phát tán dưới nhiều tên khác nhau, không ai biết bản nào là chính thức.'),
  bullet('Không kiểm soát được phân quyền: tài liệu nhạy cảm (CONFIDENTIAL) có thể bị tải bởi người không có clearance phù hợp; không có cơ chế kiểm toán độ chống chối bỏ (non-repudiation).'),
  bullet('Không tự động phát hiện can thiệp: nếu kẻ tấn công có quyền DB sửa lén audit log thì không có cơ chế cảnh báo.'),
  p('Đồ án này xây dựng hệ thống "VDT Zero-Trust DMS" — Hệ thống Quản lý Tài liệu Dự án theo mô hình Zero-Trust — giải quyết toàn diện các vấn đề nêu trên. Hệ thống bảo đảm an toàn ở mức Enterprise theo các chuẩn ABAC (Attribute-Based Access Control), SSE (Server-Side Encryption AES-256), Hash Chaining audit logs (chống tampering), và TLS 1.3 cho toàn bộ luồng giao tiếp.'),

  h2('1.2. Mục tiêu hệ thống'),
  p('Hệ thống VDT Zero-Trust DMS được thiết kế nhằm các mục tiêu cụ thể sau:'),
  bullet('Cung cấp SSOT chính thức cho tài liệu dự án — mỗi tài liệu có lifecycle xác định DRAFT → UNDER_REVIEW → RELEASED → ARCHIVED.'),
  bullet('Triển khai bảo mật Zero-Trust: mọi request đều phải qua xác thực JWT + kiểm tra phân quyền ABAC bất kể nguồn gốc.'),
  bullet('Mã hóa SSE-S3 AES-256 cho mọi object lưu trên kho lưu trữ MinIO (NFR-1.2), đảm bảo dù kẻ tấn công sao chép raw disk cũng không đọc được nội dung.'),
  bullet('Audit log có Hash Chaining (SHA-256) + Append-only Trigger ở mức database — bất kỳ thao tác UPDATE/DELETE trên audit_logs đều bị từ chối.'),
  bullet('Triển khai 1 lệnh qua Docker Compose (NFR-3.2) với 7 service: Nginx, Frontend, Backend API, Worker BullMQ, Diff Engine, Redis, MinIO; DB managed qua Supabase Cloud.'),
  bullet('Hỗ trợ workflow phê duyệt FSM, version control append-only, diff visualization, release packaging tự động (zip), tamper detection chủ động.'),

  h2('1.3. Đối tượng người dùng (Actors)'),
  p('Hệ thống định nghĩa 5 vai trò người dùng chính, được phân định rõ ràng bằng ABAC + RBAC kết hợp:'),

  table(
    [
      ['Vai trò', 'Mô tả', 'Phạm vi quyền hạn'],
      ['Guest', 'Khách chưa đăng nhập', 'Chỉ truy cập được /auth/login, /auth/register, /auth/forgot-password'],
      ['System User', 'Nhân sự đã được Admin kích hoạt', 'Truy cập Dashboard cá nhân, sửa hồ sơ, xem audit log của chính mình'],
      ['Contributor (per project)', 'Thành viên dự án được PM gán role', 'Tải lên/sửa tài liệu trong dự án mình tham gia'],
      ['Reviewer (per project)', 'Người phê duyệt tài liệu', 'Approve/Reject document UNDER_REVIEW'],
      ['Project Manager (PM)', 'Trưởng dự án', 'Quản trị team, phân quyền, archive dự án, tạo release'],
      ['Admin / Security Officer', 'Quản trị viên hệ thống', 'Toàn quyền — User Directory, ABAC Policy, Audit Ledger, Emergency Lockdown'],
    ],
    [2500, 3500, 3026],
  ),

  h2('1.4. Danh mục 26 luồng nghiệp vụ'),
  p('Hệ thống được phân tích thành 25 luồng nghiệp vụ cốt lõi và 1 luồng mở rộng (Templates Master Data), được phân thành 5 nhóm chức năng:'),

  h3('Nhóm 1 — Xác thực & Hồ sơ (Identity Access Management)'),
  table(
    [
      ['#', 'Luồng nghiệp vụ', 'Route', 'Actor'],
      ['01', 'Đăng nhập hợp nhất', '/auth/login', 'Guest'],
      ['02', 'Đăng ký nhân viên (OTP)', '/auth/register', 'Guest'],
      ['03', 'Khôi phục mật khẩu', '/auth/forgot-password', 'Guest'],
      ['04', 'Không gian làm việc (Dashboard)', '/dashboard', 'System User'],
      ['05', 'Hồ sơ cá nhân', '/profile', 'System User'],
      ['06', 'An toàn tài khoản', '/profile/security', 'System User'],
    ],
    [800, 3600, 2826, 1800],
  ),

  h3('Nhóm 2 — Quản trị IAM (Admin / Security Officer)'),
  table(
    [
      ['#', 'Luồng nghiệp vụ', 'Route', 'Actor'],
      ['07', 'Danh bạ người dùng', '/admin/users', 'Admin'],
      ['08', 'Gán thuộc tính ABAC', '/admin/users/:userId/attributes', 'Admin'],
      ['09', 'Danh mục phòng ban', '/admin/departments', 'Admin'],
    ],
    [800, 3600, 2826, 1800],
  ),

  h3('Nhóm 3 — Dự án & Thư mục (Workspace & Project)'),
  table(
    [
      ['#', 'Luồng nghiệp vụ', 'Route', 'Actor'],
      ['10', 'Danh mục dự án', '/projects', 'System User / PM'],
      ['11', 'Khởi tạo dự án', '/projects/create', 'PM / Admin'],
      ['12', 'Trình duyệt thư mục', '/projects/:pid/folders/:fid', 'Contributor / PM'],
      ['13', 'Quản trị nhân sự dự án', '/projects/:pid/team', 'PM'],
      ['14', 'Cấu hình dự án', '/projects/:pid/settings', 'PM'],
    ],
    [800, 3600, 2826, 1800],
  ),

  h3('Nhóm 4 — Tài liệu, Phiên bản & Diff (Document Control)'),
  table(
    [
      ['#', 'Luồng nghiệp vụ', 'Route', 'Actor'],
      ['15', 'Tải lên tài liệu', '/projects/:pid/documents/upload', 'Contributor / PM'],
      ['16', 'Bảng điều khiển tài liệu', '/documents/:docId/detail', 'System User / PM'],
      ['17', 'Quy trình phê duyệt', '/documents/:docId/review', 'PM / Reviewer'],
      ['18', 'So sánh khác biệt (Diff)', '/documents/:docId/diff', 'PM / Reviewer'],
      ['19', 'Gói phát hành (Release)', '/projects/:pid/releases', 'PM'],
      ['20', 'Bảng kiểm tuân thủ', '/projects/:pid/releases/:rid', 'PM / Admin'],
    ],
    [800, 3600, 2826, 1800],
  ),

  h3('Nhóm 5 — Chính sách & Kiểm toán (Security & Compliance)'),
  table(
    [
      ['#', 'Luồng nghiệp vụ', 'Route', 'Actor'],
      ['21', 'Quản lý chính sách ABAC', '/admin/policies', 'Admin'],
      ['22', 'Trình xây dựng luật trực quan', '/admin/policies/builder', 'Admin'],
      ['23', 'Sổ cái nhật ký kiểm toán', '/admin/audit-logs', 'Admin'],
      ['24', 'Kết xuất tuân thủ', '/admin/audit-logs/export', 'Admin'],
      ['25', 'Trung tâm phát hiện can thiệp', '/admin/security-alerts', 'Admin'],
      ['26', 'Mẫu dự án (bonus)', '/admin/project-templates', 'Admin'],
    ],
    [800, 3600, 2826, 1800],
  ),

  h2('1.5. Yêu cầu chức năng (Functional Requirements)'),
  p('Hệ thống bao gồm các yêu cầu chức năng được chia thành 6 nhóm chính:'),

  h3('FR-1: Xác thực & Quản lý phiên'),
  bullet('FR-1.1.1: Đăng nhập với email/password + JWT access token + refresh token rotation.'),
  bullet('FR-1.1.2: Google SSO với domain restriction tùy chọn (opt-in qua biến ALLOWED_EMAIL_DOMAIN).'),
  bullet('FR-1.1.3: Chống brute-force — khóa nút Login 60s sau 3 lần sai liên tiếp.'),
  bullet('FR-1.2.1: Mass Session Eviction khi Admin disable user — đá văng JWT cũ trong < 1s.'),
  bullet('FR-1.2.3: Password Confirmation Gate trước khi user sửa hồ sơ cá nhân.'),

  h3('FR-2: Dự án & Tài liệu'),
  bullet('FR-2.1.1: Khởi tạo dự án ACID — sinh cây thư mục từ template + Casbin grouping policy trong 1 transaction.'),
  bullet('FR-2.1.2: Resource Management với 4 vai trò (PM/CONTRIBUTOR/REVIEWER/VIEWER).'),
  bullet('FR-2.2.1: Upload tài liệu qua multer memoryStorage → MinIO SSE-S3 → BullMQ extract text.'),
  bullet('FR-2.3.1: FSM Workflow phê duyệt DRAFT → UNDER_REVIEW → RELEASED/DRAFT.'),
  bullet('FR-2.3.2: Strict State Gatekeeper — DRAFT chỉ owner/PM/Admin xem được.'),

  h3('FR-3: Versioning & Diff'),
  bullet('FR-3.1.2: Rollback Append-only — restore version cũ tạo bản mới, không xóa lịch sử.'),
  bullet('FR-3.1.3: Non-repudiation Versioning — tất cả lịch sử thay đổi đều được giữ.'),
  bullet('FR-3.2.1: Giới hạn upload 50MB; > 15MB tắt diff tự động (NFR-2.2).'),
  bullet('FR-3.3.1: Diff Engine vi dịch vụ Python FastAPI với difflib.SequenceMatcher.'),

  h3('FR-4: ABAC & Phân quyền'),
  bullet('FR-4.1.3: Default Deny — không có luật match → từ chối, không bao giờ fail-open.'),
  bullet('FR-4.2.1: Thông báo từ chối chung chung — không tiết lộ chi tiết luật để tránh thông tin bị suy luận.'),

  h3('FR-5: Audit & Compliance'),
  bullet('FR-5.1.2: Audit Log Before/After Payload cho mọi hành vi đổi thuộc tính ABAC.'),
  bullet('FR-5.2: Hash Chaining SHA-256 — mỗi audit row "móc xích" với row trước.'),
  bullet('FR-5.3.1: Anomaly Detection — Redis ZSET sliding window, > 10 download/phút → 429.'),
  bullet('FR-5.3.2: PDF/CSV export với watermark dynamic + SHA-256 footer chữ ký.'),

  h2('1.6. Yêu cầu phi chức năng (Non-Functional Requirements)'),
  table(
    [
      ['Mã', 'Yêu cầu', 'Cách hiện thực'],
      ['NFR-1.1', 'TLS 1.3 enforced', 'Nginx ssl_protocols TLSv1.3; HSTS max-age=2 năm; HTTP → 301 redirect HTTPS'],
      ['NFR-1.2', 'SSE-S3 AES-256 cho mọi object', 'MinIO MINIO_KMS_SECRET_KEY single-key; bucket mc encrypt set sse-s3'],
      ['NFR-1.3', 'Audit logs append-only', 'PostgreSQL trigger prevent_audit_mutation chặn UPDATE/DELETE'],
      ['NFR-2.2', 'Async diff offload', 'BullMQ text-extraction queue + Worker container riêng (không block API)'],
      ['NFR-3.1', 'Modular Monolith', 'NestJS @Global() InfraModule, 12 feature modules tách rời'],
      ['NFR-3.2', '1-command deploy', 'docker compose up -d --build → 7 service'],
    ],
    [1300, 2800, 4926],
  ),

  h2('1.7. Sơ đồ Use Case tổng thể'),
  p('Sơ đồ Use Case tổng thể của hệ thống bao gồm 5 nhóm chính, 6 actor, và 26 use case. Mỗi use case tương ứng 1 luồng nghiệp vụ ở Mục 1.4. Các quan hệ chính:'),
  bullet('Include: Mọi use case "có ABAC check" đều include "Authenticate JWT + Casbin Enforce".'),
  bullet('Extend: Use case Download Document extend bằng Anomaly Detection (kiểm Redis ZSET) — chỉ active khi tải > 10/phút.'),
  bullet('Generalization: PM kế thừa System User; Admin kế thừa PM; Security Officer ≡ Admin (về quyền hạn).'),
  p('Sơ đồ chi tiết được thể hiện bằng PlantUML/Draw.io trong tài liệu phụ lục (export ra ảnh PNG dán vào bản in cuối).'),
];

// ============================================================================
// CHƯƠNG 2 — THIẾT KẾ HỆ THỐNG (~28 trang)
// ============================================================================
const chapter2 = [
  h1('CHƯƠNG 2. THIẾT KẾ HỆ THỐNG'),

  h2('2.1. Kiến trúc tổng thể (4 lớp)'),
  p('Hệ thống được thiết kế theo kiến trúc Modular Monolith 4 lớp, hướng Event-Driven, triển khai trên Docker Compose. Mô hình bám sát chuẩn Enterprise với separation of concerns rõ ràng:'),
  bullet('Lớp Client: React 18 SPA + Vite + Tailwind CSS, Feature-Sliced Design.'),
  bullet('Lớp Gateway: Nginx reverse proxy ép TLS 1.3, rate-limit, proxy /storage MinIO.'),
  bullet('Lớp Application: NestJS 10 (api + worker cùng image, khác CMD); FastAPI diff-engine vi dịch vụ Python.'),
  bullet('Lớp Data: Supabase PostgreSQL cloud (managed) + Redis (cache/queue) + MinIO (S3 storage, SSE).'),

  code(`┌──────────────────────────────────────────────────────────────┐
│                  TRÌNH DUYỆT (Chrome / Edge)                  │
│                  https://localhost (TLS 1.3)                  │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────┐
│            NGINX (vdt-nginx) — Port 80/443                    │
│  • TLSv1.3 enforced, HSTS, X-Frame-Options                    │
│  • Rate-limit zones: api_limit 20r/s, auth_limit 5r/s         │
│  • Proxy /api → backend:3000; / → frontend:80                 │
│  • Proxy /<bucket>/ → minio:9000 (preserve SigV4 path)        │
└──┬───────────────┬───────────────┬───────────────────────────┘
   │ /             │ /api/         │ /vdt-docs/
   ▼               ▼               ▼
┌─────────────┐ ┌──────────────────┐ ┌─────────────────────┐
│ FRONTEND    │ │  BACKEND (vdt-   │ │   MINIO (S3 API)    │
│ React SPA   │ │  api) NestJS 10  │ │   SSE-S3 AES-256    │
│ (Nginx svc) │ │  ports 3000      │ │   port 9000 + 9001  │
└─────────────┘ └─────────┬────────┘ └─────────────────────┘
                          │
       ┌──────────────────┼────────────────────────┐
       │                  │                        │
       ▼                  ▼                        ▼
┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐
│ SUPABASE     │  │ REDIS (vdt-   │  │ vdt-worker (BullMQ)  │
│ PostgreSQL   │  │ redis) 6379   │  │ 4 queues: extract,   │
│ Cloud Pooler │  │ Session +     │  │ mailer, release-zip, │
│ 6543 / 5432  │  │ Queue + Cache │  │ integrity-scan       │
└──────────────┘  └───────────────┘  └──────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  vdt-diff-engine — Python FastAPI port 8000                   │
│  difflib.SequenceMatcher.get_opcodes() so sánh 2 raw_text     │
└──────────────────────────────────────────────────────────────┘`),

  h2('2.2. Tech Stack'),
  table(
    [
      ['Lớp', 'Công nghệ', 'Vai trò chính'],
      ['Frontend', 'React 18 + Vite 5 + TypeScript', 'SPA, Feature-Sliced Design'],
      ['UI Library', 'Tailwind CSS 3 + react-router-dom v6', 'Styling utility-first + routing client-side'],
      ['State Management', 'zustand + @tanstack/react-query', 'Session persist localStorage + data-fetching cache'],
      ['Backend', 'NestJS 10 + TypeScript', 'Modular Monolith, 12 feature modules'],
      ['ORM', 'Prisma 5 + casbin-prisma-adapter 1.6', 'Type-safe DB client'],
      ['Database', 'PostgreSQL 16 (Supabase managed)', 'Partition + Trigger + JSONB'],
      ['Storage', 'MinIO (S3-compatible)', 'SSE-S3 AES-256, presigned URL'],
      ['Cache/Queue', 'Redis 7 + BullMQ 5', 'Session, blacklist, rate-limit, 4 queues'],
      ['Policy Engine', 'Node-Casbin (RBAC + keyMatchPath)', 'ABAC enforce qua casbin_rule table'],
      ['Diff Service', 'Python 3.11 + FastAPI + difflib', 'Microservice keep-alive'],
      ['Email', 'Nodemailer + Gmail SMTP App Password', 'OTP, kết quả review, request unlock'],
      ['Gateway', 'Nginx 1.27-alpine', 'TLS 1.3, rate-limit, /storage proxy'],
      ['Orchestrator', 'Docker Compose v2', '1-command deploy 7 service'],
    ],
    [1800, 3500, 3726],
  ),

  h2('2.3. Mô hình dữ liệu (ERD)'),
  p('Hệ thống có 13 bảng public schema + 12 partition audit_logs (RANGE theo timestamp tháng) + 3 trigger (Hash Chaining + Append-only) + 8 native enum types. Lược đồ chính:'),

  h3('2.3.1. Bảng nhân sự & phòng ban'),
  table(
    [
      ['Bảng', 'Trường chính', 'Mô tả'],
      ['departments', 'id (uuid), name (unique), is_active', 'Master data phòng ban'],
      ['profiles', 'id, email (unique), password_hash, full_name, department_id, title, clearance_level (PUBLIC/INTERNAL/CONFIDENTIAL), status', 'Nhân sự — clearance là ABAC attribute quan trọng'],
    ],
    [1800, 3800, 3426],
  ),

  h3('2.3.2. Bảng dự án & thành viên'),
  table(
    [
      ['Bảng', 'Trường chính', 'Mô tả'],
      ['projects', 'id, name, description, owner_id, status (ACTIVE/ARCHIVED)', 'Dự án — owner_id = PM tạo'],
      ['project_members', 'project_id, user_id, project_role (PM/CONTRIBUTOR/REVIEWER/VIEWER), assigned_at', 'Composite PK; quan hệ N-N'],
      ['user_project_preferences', 'user_id, project_id, is_starred', 'Ghim dự án theo user'],
    ],
    [1800, 3800, 3426],
  ),

  h3('2.3.3. Bảng tài liệu & version'),
  table(
    [
      ['Bảng', 'Trường chính', 'Mô tả'],
      ['folders', 'id, project_id, parent_id (recursive), name, is_locked', 'Cây thư mục dự án; is_locked = template chuẩn'],
      ['documents', 'id, project_id, folder_id, title, security_level, status (DRAFT/UNDER_REVIEW/RELEASED/ARCHIVED), locked_by (Redis), published_version_id, is_deleted', 'Tài liệu — Pessimistic Lock qua Redis'],
      ['document_versions', 'id, document_id, version_no, storage_key, raw_text_storage_key, file_type, file_size, commit_message, uploaded_by', 'Append-only history; raw_text bóc tách bằng worker'],
    ],
    [1800, 3800, 3426],
  ),

  h3('2.3.4. Bảng release & template'),
  table(
    [
      ['Bảng', 'Trường chính', 'Mô tả'],
      ['releases', 'id, project_id, release_name, template_type, status (PROCESSING/VERIFIED/VIOLATED), compliance_score, zip_storage_key', 'Snapshot version RELEASED tại 1 thời điểm'],
      ['release_document_versions', 'release_id, document_version_id', 'M-N — snapshot immutable'],
      ['project_templates', 'id, name, template_type (unique), description, is_active', 'Master data template (SOFTWARE_DEV, INFRA_DEPLOY...)'],
      ['template_folders', 'id, template_id, name, parent_path, is_locked, display_order', 'Path Materialization — cây folder mẫu'],
    ],
    [1800, 3800, 3426],
  ),

  h3('2.3.5. Bảng audit & policy'),
  table(
    [
      ['Bảng', 'Trường chính', 'Mô tả'],
      ['audit_logs (PARTITIONED)', 'id, timestamp, user_id, action, target_id, ip_address, is_success, fail_reason, metadata (jsonb), previous_hash, current_hash', 'PARTITION BY RANGE (timestamp); 12 partition tháng + default; Hash Chaining SHA-256; Append-only'],
      ['casbin_rule', 'id, ptype (p/g), v0-v5', 'Lưu policy ABAC; Casbin engine load + reload'],
    ],
    [1800, 3800, 3426],
  ),

  h3('2.3.6. Tổng quan ERD'),
  code(`departments 1 ───< profiles
                       │
                       ├──< project_members >──┐
                       │                       │
                       ├──< user_project_pref >─┤
                       │                       │
                       └──< documents.created_by│
                                                │
projects ──────────────────────────────────────┘
   │
   ├──< folders (self-recursive parent_id)
   │       │
   │       └──< documents ──< document_versions ──< release_document_versions
   │                                                    │
   ├──< releases ─────────────────────────────────────────┘
   │
   └── owner_id ───> profiles

project_templates ──< template_folders (parent_path materialized)
                  │
                  └── projects.template_type (via createProject)

audit_logs (partition by month) — Hash Chain ─ INSERT-only trigger
casbin_rule — Casbin Engine load policy`),

  h2('2.4. Diagram Package — Backend NestJS Modular Monolith'),
  p('Backend được tổ chức theo Modular Monolith pattern, mỗi feature module độc lập + dependency rõ ràng vào @Global() InfraModule và CoreModule:'),
  code(`backend/src/
├── infra/                          [@Global() Module — provided to all]
│   ├── database/prisma.service.ts
│   ├── cache/redis.service.ts
│   ├── storage/minio-s3.service.ts (2 S3 clients: internal + public)
│   ├── queue/queue.module.ts       (4 BullMQ queues)
│   └── abac/casbin-enforcer.service.ts
│
├── core/                           [@Global() — guards, interceptors, decorators]
│   ├── guards/lockdown-503.guard.ts
│   ├── guards/jwt-auth.guard.ts
│   ├── guards/casbin-abac.guard.ts
│   ├── guards/admin.guard.ts
│   ├── interceptors/timeout.interceptor.ts
│   ├── interceptors/audit-hash.interceptor.ts
│   ├── filters/global-exception.filter.ts
│   ├── audit/audit.service.ts
│   └── decorators/{public,audit,check-policy,current-user}.decorator.ts
│
├── modules/                        [12 feature modules]
│   ├── auth/        (Luồng 1, 2, 3)  — JWT + OTP + Google SSO
│   ├── profile/     (Luồng 5, 6)     — Hồ sơ + session mgmt
│   ├── admin/       (Luồng 7, 8, 9)  — User Directory + Departments
│   ├── dashboard/   (Luồng 4)
│   ├── projects/    (Luồng 10-14)    — Portfolio + ACID create + Team + Settings
│   ├── documents/   (Luồng 12, 15, 16, 18) — Folder + Upload + Detail + Diff
│   ├── workflow/    (Luồng 17)       — FSM Approve/Reject
│   ├── releases/    (Luồng 19, 20)   — Snapshot + Compliance + Export
│   ├── policies/    (Luồng 21, 22)   — Casbin CRUD + Simulator
│   ├── security/    (Luồng 23-25)    — Audit + Tamper + Lockdown
│   └── templates/   (Luồng 26)       — Path Materialization
│
└── workers/                        [BullMQ Worker container]
    ├── main.worker.ts
    ├── extractor.processor.ts       (pdf-parse, mammoth, raw text)
    ├── mailer.processor.ts          (Nodemailer)
    ├── archiver.processor.ts        (zip release)
    └── integrity-checker.processor.ts (verify Hash Chain)`),

  h2('2.5. Class Diagram — Module Auth'),
  p('Để minh họa, sơ đồ class của module Auth (Luồng 1-3) — bao quát nhất:'),
  code(`+──────────────────────────────────────────────────────────────+
| AuthController                                                |
+──────────────────────────────────────────────────────────────+
| - authService: AuthService                                    |
+──────────────────────────────────────────────────────────────+
| + login(LoginDto): { accessToken, refreshToken, user }        |
| + refresh(@Req): renewedTokens                                |
| + logout(@CurrentUser): { message }                           |
| + registerRequest(RegisterRequestDto): { expiresIn }          |
| + verifyRegisterOtp(VerifyOtpDto): { userId }                 |
| + forgotPasswordRequest(ForgotPasswordRequestDto)              |
| + resetPasswordConfirm(ResetPasswordConfirmDto)                |
| + googleAuth() [GoogleAuthGuard]                              |
| + googleCallback(@Req,@Res): redirect /sso-callback?token=    |
+──────────────────────────────────────────────────────────────+
                      │ uses
                      ▼
+──────────────────────────────────────────────────────────────+
| AuthService                                                   |
+──────────────────────────────────────────────────────────────+
| - prisma, redis, jwt, audit, otp, mail                        |
| - saltRounds: number = 10                                     |
| - accessTtl: '15m', refreshTtl: '7d'                          |
| - allowedDomain: string ('' = không giới hạn)                 |
+──────────────────────────────────────────────────────────────+
| + login(dto, ip, ua): IssuedTokens & user                     |
| + refresh(token, ip, ua): IssuedTokens & user                 |
| + logout(userId, jti, refreshCookie, ip)                      |
| + registerRequest(dto, ip): { message, expiresIn }            |
| + verifyRegisterOtp(dto, ip): { userId }                      |
| + forgotPasswordRequest(dto, ip): generic message             |
| + resetPasswordConfirm(dto, ip)                               |
| + googleLogin(email, ip, ua): IssuedTokens & user             |
| - assertNotBruteForced(email)                                 |
| - issueTokens(profile, ctx): IssuedTokens                     |
| - revokeAllSessions(userId)                                   |
| + listSessions(userId, currentJti): SessionMeta[]             |
| + revokeSession(userId, sessionId)                            |
+──────────────────────────────────────────────────────────────+
                      │ uses
        ┌─────────────┼─────────────────────┐
        ▼             ▼                     ▼
+────────────+  +────────────+      +────────────────+
| OtpService |  | MailService|      | GoogleStrategy |
+────────────+  +────────────+      +────────────────+
| + generate |  | + sendOtp  |      | + validate     |
| + verify   |  | + sendReviewResult |                |
+────────────+  +────────────+      +────────────────+`),

  h2('2.6. Sequence Diagram — 5 luồng quan trọng'),

  h3('2.6.1. Luồng Đăng nhập (Login)'),
  code(`Browser              Nginx          Backend           Supabase       Redis
   │                    │                │                  │             │
   │ POST /auth/login   │                │                  │             │
   │ {email,password}   │                │                  │             │
   ├───────────────────>│                │                  │             │
   │                    ├───────────────>│                  │             │
   │                    │                │ SELECT profile   │             │
   │                    │                │ by email         │             │
   │                    │                ├─────────────────>│             │
   │                    │                │<─────────────────┤             │
   │                    │                │ bcrypt.compare   │             │
   │                    │                │ generate JWT     │             │
   │                    │                │ SET session_key  │             │
   │                    │                ├────────────────────────────────>│
   │                    │                │ INSERT audit_log │             │
   │                    │                │ (Hash Chain trigger)            │
   │                    │                ├─────────────────>│             │
   │ 200 + accessToken  │<───────────────┤                  │             │
   │ HttpOnly refresh   │                │                  │             │
   │<───────────────────┤                │                  │             │
`),

  h3('2.6.2. Luồng Upload tài liệu (Luồng 15)'),
  code(`Browser   Nginx    Backend   MinIO   Supabase   Redis   Worker
   │       │         │          │       │           │       │
   │ POST /upload (multipart)   │       │           │       │
   ├──────>│────────>│          │       │           │       │
   │       │         │ multer parseBuffer            │       │
   │       │         │ assertCanEdit + clearance     │       │
   │       │         ├─────────>│       │           │       │ PutObject SSE-S3
   │       │         │<─────────┤       │           │       │
   │       │         │ INSERT documents+versions    │       │
   │       │         ├──────────────────>│          │       │
   │       │         │ DEL doc:lock:* (Redis)       │       │
   │       │         ├─────────────────────────────>│       │
   │       │         │ BullMQ.add('text-extraction')│       │
   │       │         ├─────────────────────────────>│       │
   │       │         │                              │       │
   │       │         │      ┌───────────────────────┴───────┤ BLPOP queue
   │       │         │      │ Worker pulls job              │
   │       │         │      │ download file MinIO           │
   │       │         │      │ pdf-parse / mammoth           │
   │       │         │      │ PutObject raw_text            │
   │       │         │      │ UPDATE document_versions      │
   │ 201 documentId  │<─────┤      text_extracted=true      │
   │<──────┤<────────┤      │                               │`),

  h3('2.6.3. Luồng Phê duyệt (Luồng 17 — FSM)'),
  code(`Browser   Backend    Supabase   Redis     Worker (Mailer)   SMTP Gmail
   │         │           │           │              │              │
   │ POST /review {APPROVE,comment}  │              │              │
   ├────────>│           │           │              │              │
   │         │ assertReviewer (Casbin)              │              │
   │         │ check FSM: status=UNDER_REVIEW       │              │
   │         │ UPDATE documents SET status=RELEASED │              │
   │         │           │ published_version_id=v2 │              │
   │         ├──────────>│           │              │              │
   │         │ DEL abac:cache:<userId>              │              │
   │         ├───────────────────────>│              │              │
   │         │ INSERT audit_log WORKFLOW_DECISION   │              │
   │         ├──────────>│ (Hash Chain trigger)    │              │
   │         │ BullMQ.add('mailer', {to: author})  │              │
   │         ├───────────────────────>│              │              │
   │ 200 {newStatus}                  │              │              │
   │<────────┤           │            │ BLPOP        │              │
   │                     │            ├─────────────>│              │
   │                     │            │            Nodemailer       │
   │                     │            │              ├─────────────>│
   │                     │            │              │ smtp.gmail   │`),

  h3('2.6.4. Luồng So sánh Diff (Luồng 18)'),
  code(`Browser   Backend     Supabase    MinIO         Diff Engine (Py)
   │         │              │           │              │
   │ GET /documents/:id/diff?v1=1&v2=2  │              │
   ├────────>│              │           │              │
   │         │ assertMember │           │              │
   │         │ SELECT 2 versions        │              │
   │         ├─────────────>│           │              │
   │         │ getInternalPresignedUrl(rawTextKey_v1)  │
   │         ├──────────────────────────>│             │
   │         │ getInternalPresignedUrl(rawTextKey_v2)  │
   │         ├──────────────────────────>│             │
   │         │ POST /diff {url1, url2}  │              │
   │         ├──────────────────────────────────────────>│
   │         │              │           │   download   │
   │         │              │           │<─────────────┤
   │         │              │           │  text v1, v2 │
   │         │              │           │              │
   │         │              │           │  difflib.SequenceMatcher
   │         │              │           │  get_opcodes()
   │         │              │           │              │
   │         │<──────────────────────────────────────────│
   │         │ { deltas:[{type:'added',...}], originalUrls }
   │ 200     │              │           │              │
   │<────────┤              │           │              │`),

  h3('2.6.5. Luồng Tamper Detection (Luồng 25)'),
  code(`Admin Browser  Backend     Redis        Worker (Scanner)    Supabase
      │            │            │              │                  │
      │ POST /admin/security/trigger-verify    │                  │
      ├──────────>│             │              │                  │
      │            │ BullMQ.add('integrity-scan')│                 │
      │            ├────────────>│              │                  │
      │ 202 jobId  │             │              │                  │
      │<──────────┤             │  BLPOP       │                  │
      │            │             ├─────────────>│                  │
      │            │             │              │ SELECT audit_logs│
      │            │             │              │ LIMIT 1000        │
      │            │             │              ├─────────────────>│
      │            │             │              │  rows[1..1000]    │
      │            │             │              │<─────────────────┤
      │            │             │              │ For each row:     │
      │            │             │              │  SHA256(prev_hash │
      │            │             │              │   || row payload) │
      │            │             │              │  vs stored hash   │
      │            │             │              │                   │
      │            │             │              │ If mismatch:      │
      │            │             │              │ → INSERT log      │
      │            │             │              │   SECURITY_ALERT  │
      │            │             │              ├──────────────────>│
      │            │             │              │ SET system:scan-result
      │            │             │<─────────────┤   = COMPROMISED   │
      │            │             │              │                   │
      │ Poll GET /verify-integrity               │                  │
      ├──────────>│              │              │                  │
      │            │ GET system:scan-result      │                  │
      │            ├────────────>│              │                  │
      │ {status: COMPROMISED, corruptedRowId: 5} │                  │
      │<──────────┤              │              │                  │`),

  h2('2.7. Thiết kế giao diện (UI)'),
  p('Hệ thống có 25 màn hình lõi + 1 bonus (templates). Mỗi màn hình tuân thủ design system với palette màu Viettel Red (#E60012), Dark (#1a1a1a), background xám nhạt. Một số đặc điểm chung:'),
  bullet('Layout: 56px sidebar trái (3 nhóm menu: Workspace, Admin Nhân sự, Admin An ninh) + topbar 64px (3 chip role/department/clearance + avatar dropdown).'),
  bullet('Component thư viện: BackButton, OtpInput (6 ô), PasswordStrengthMeter (5 rule + meter), PreviewModal (md/txt/docx/pdf).'),
  bullet('UX patterns: Stepper cho register/forgot, Master-Detail Split (Departments/Templates), Floating Action Bar (Bulk Actions, Diff Selection), Modal đỏ Danger Zone (Archive/Delete).'),
  bullet('A11y: focus ring viettel-red, keyboard nav, ARIA labels cho icon-only buttons.'),

  h3('2.7.1. Bảng tóm tắt 25 màn hình'),
  table(
    [
      ['Màn hình', 'Layout pattern', 'Đặc điểm UX'],
      ['Login', 'Split-screen 50/50', 'Visual branding + form 400px; prefill demo creds; Google SSO button'],
      ['Register', 'Card + Stepper 2 bước', 'Slide animation; password strength meter; OTP 6 ô'],
      ['Dashboard', 'Stat cards + lists', '4 metric card (highlight nếu có locks); card vàng "Bạn đang giữ N lock"'],
      ['Profile', 'Asymmetric 2-column', 'Identity card read-only trái + form phải; Password Gate Modal 3-fail-lock-60s'],
      ['User Directory', 'Data Table + Bulk Bar', 'Debounce 300ms; floating bar khi multi-select; Mass Eviction confirm'],
      ['Attribute Assignment', 'Two-column Focused', 'Static summary trái + form ABAC phải; Clearance Escalation Warning'],
      ['Project Create Wizard', 'Stepper 2 bước', 'Step 1: name + template radio cards + preview tree; Step 2: search + role'],
      ['Folder Navigator', 'Breadcrumbs + Grid + Table', 'Subfolder cards (📁/🔒) + docs table; 4 nút action (Create, Empty, Folder upload, File upload)'],
      ['Document Upload', 'Dropzone 2/3 + Form 1/3', 'Drag-over animation; pre-validation; progress KB/s thật'],
      ['Document Detail', 'Tabs (3) + Action Bar', 'Preview (MD render / DOCX mammoth / PDF iframe / TXT pre); Lock UI; online editor textarea'],
      ['Document Review', 'Split-screen', 'Iframe preview trái + Decision panel phải; Reject reason ≥10 chars; Action Block Overlay'],
      ['Document Diff', 'Toggle Original/Diff', 'Iframe MinIO + delta split-view'],
      ['Releases', 'Table + Modal', 'List + tạo release modal'],
      ['Compliance', 'Checklist + Export', 'BFS subtree check; Export polling'],
      ['Audit Ledger', 'Cursor paginated table', 'Row expansion JSON; filter by action/status'],
      ['Audit Export', 'Form + Preview', 'datetime-local + quick presets; PDF/CSV; live 50 rows'],
      ['Tamper Hub', 'Banner + Stats + Alerts', 'Hero SECURE/COMPROMISED; explainer Hash Chain; Lockdown hold 3s'],
      ['Policy Builder', 'Triple-panel', 'List policies + Visual Builder live-JSON + Simulator highlight'],
      ['Policy Guide', 'Long-form', '6 section dạy ABAC + 5 ví dụ thực tế'],
      ['Template Tree Builder', 'Master-Detail', 'List templates + recursive tree với hover menu (+/✎/🔒/🗑)'],
      ['Sessions Security', 'Split-grid', 'Change password trái + active sessions phải với device icon'],
      ['Project Team', 'Single-Column Grid', 'Inline role dropdown + AddMemberModal async; Self-Removal Protection'],
      ['Project Settings', 'Sectioned + Danger Zone', 'General + Archive modal "type project name" confirm'],
      ['Departments', 'Master-Detail Split', 'Inline uniqueness validation; Safe Delete Guard employeeCount>0'],
      ['SSO Callback', 'Full-screen Loading', 'Set session + fetch /profile + redirect dashboard'],
    ],
    [2400, 2400, 4226],
  ),

  h2('2.8. Cơ chế bảo mật'),

  h3('2.8.1. ABAC + Casbin Policy Engine'),
  p('Hệ thống sử dụng Node-Casbin làm policy engine ABAC. Model file `rbac_with_keymatch.conf` định nghĩa kết hợp RBAC role + keyMatchPath cho URL pattern:'),
  code(`[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatchPath(r.obj, p.obj) && (r.act == p.act || p.act == "*")`),
  p('Bảng casbin_rule lưu 2 loại policy: "p" (policy) và "g" (grouping/role assignment). Ví dụ:'),
  bullet('g, <admin_user_id>, role_admin  — Gán user X thành admin'),
  bullet('p, role_admin, /*, *  — role_admin được mọi action trên mọi path'),
  bullet('g, <pm_user_id>, role_pm_<projectId>  — User là PM của project cụ thể'),
  bullet('p, role_pm_<projectId>, /api/v1/projects/<projectId>/*, *  — PM full access trên project của mình'),

  h3('2.8.2. Hash Chaining audit_logs (FR-5.2)'),
  p('Mỗi dòng audit_logs có 2 trường previous_hash và current_hash. PostgreSQL trigger compute_audit_hash chạy tự động ở BEFORE INSERT:'),
  code(`current_hash = SHA256(
  COALESCE(previous_hash, '') || user_id::text || action ||
  COALESCE(target_id, '') || COALESCE(ip_address, '') ||
  timestamp::text || is_success::text
)
previous_hash = (SELECT current_hash FROM audit_logs
                 ORDER BY timestamp DESC, id DESC LIMIT 1)`),
  p('Hash chain đảm bảo: sửa bất kỳ dòng nào giữa chuỗi sẽ break tất cả hash dòng sau. Worker integrity-checker quét theo Keyset Pagination 1000 rows/lô, so sánh recompute SHA256 vs stored value. Nếu mismatch → INSERT row SECURITY_ALERT mới + set Redis system:scan-result = COMPROMISED.'),

  h3('2.8.3. Append-only Trigger (NFR-1.3)'),
  p('2 trigger DB chặn UPDATE/DELETE:'),
  code(`CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE FUNCTION prevent_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (NFR-1.3)';
END $$ LANGUAGE plpgsql;`),
  p('Để bypass cần quyền superuser Postgres với SET session_replication_role = replica — chỉ cấp cho DBA, không bao giờ cho application user.'),

  h3('2.8.4. JWT Access + Refresh Rotation'),
  bullet('Access token: JWT ngắn 15 phút, chứa claims (sub, email, fullName, department, title, clearanceLevel, authProvider, jti).'),
  bullet('Refresh token: HttpOnly cookie 7 ngày, path=/api/v1, SameSite=Lax.'),
  bullet('Khi refresh: backend rotate jti, blacklist jti cũ qua Redis SETEX blacklist:<jti> với TTL = remaining.'),
  bullet('Mass Session Eviction: khi admin disable user → DEL session:<userId>:* + SADD blacklist:<jti1>..jtiN.'),

  h3('2.8.5. SSE-S3 AES-256 (NFR-1.2)'),
  bullet('MinIO bật KMS single-key qua biến MINIO_KMS_SECRET_KEY (32-byte base64).'),
  bullet('Bucket vdt-docs auto-encrypt: `mc encrypt set sse-s3 local/vdt-docs`.'),
  bullet('Mọi PutObjectCommand từ backend đều có ServerSideEncryption: "AES256". MinIO mã hóa ở mức object trước khi ghi disk.'),
  bullet('Verify: docker exec vdt-minio cat /data/vdt-docs/.../v1_*.pdf → binary garbled không đọc được.'),

  h3('2.8.6. Anomaly Detection (FR-5.3.1)'),
  p('Mỗi lần user tải tài liệu, backend gọi Redis ZSET sliding window:'),
  code(`ZADD user:download_freq:<userId> <timestamp_ms> "<docId>:<ts>"
ZREMRANGEBYSCORE user:download_freq:<userId> 0 <ts - 60_000>
ZCARD user:download_freq:<userId>  → count trong 1 phút`),
  p('Nếu count > 10 → 429 Too Many Requests + ghi audit SECURITY_ALERT. UI Tamper Hub auto refresh và nhảy cảnh báo realtime qua polling 5s.'),

  h3('2.8.7. Emergency Lockdown'),
  bullet('Admin có thể bấm "EMERGENCY LOCKDOWN" trên Tamper Hub với hold-to-confirm 3 giây.'),
  bullet('Yêu cầu PIN (env EMERGENCY_PIN) + lý do ≥10 ký tự.'),
  bullet('Backend SET Redis system:lockdown = 1. Lockdown503Guard (global guard #1) return 503 cho mọi request trừ IP whitelist (LOCKDOWN_SAFE_IP).'),
  bullet('Chỉ Admin có IP trong whitelist mới release được lockdown.'),

  h2('2.9. Workflow tài liệu FSM (Finite State Machine)'),
  p('Lifecycle 4 trạng thái với transition được kiểm soát chặt chẽ ở backend:'),
  code(`              ┌─────────┐  upload v_new  ┌─────────┐
              │  DRAFT  │ ◀───────────────── │ DRAFT   │
              └────┬────┘                    └─────────┘
   submit-review  │
                  ▼
            ┌──────────────┐
            │ UNDER_REVIEW │  REJECT(comment≥10) ───► DRAFT
            └──────┬───────┘                    + lock release
        APPROVE   │
                  ▼
            ┌──────────┐  archive ┌──────────┐
            │ RELEASED │ ────────►│ ARCHIVED │ (project ARCHIVED)
            └──────────┘          └──────────┘`),
  p('Quy tắc transition:'),
  bullet('DRAFT → UNDER_REVIEW: chỉ Contributor/PM submit; lock document.'),
  bullet('UNDER_REVIEW → RELEASED: chỉ Reviewer/PM Approve; gán published_version_id.'),
  bullet('UNDER_REVIEW → DRAFT: Reject (comment ≥10); giải phóng lock; gửi mailer notification.'),
  bullet('RELEASED + project Archive → ARCHIVED: read-only static; gỡ mọi lock; vẫn Export được.'),

  h2('2.10. Triển khai (Deployment)'),

  h3('2.10.1. Docker Compose 7 service'),
  p('Toàn bộ stack được orchestrate bằng docker-compose.yml với 1 lệnh `make up`:'),
  table(
    [
      ['Service', 'Image', 'Port', 'Vai trò'],
      ['vdt-nginx', 'nginx:1.27-alpine', '80, 443', 'Reverse proxy, TLS 1.3, rate limit, /storage'],
      ['vdt-frontend', '(build ./frontend)', '80 (internal)', 'React SPA static via Nginx'],
      ['vdt-api', '(build ./backend)', '3000', 'NestJS API server'],
      ['vdt-worker', '(build ./backend, APP_ROLE=worker)', '—', 'BullMQ 4 queues consumer'],
      ['vdt-diff-engine', '(build ./diff-engine)', '8000', 'Python FastAPI difflib'],
      ['vdt-redis', 'redis:7-alpine', '6379', 'Session/blacklist/cache/queue'],
      ['vdt-minio', 'minio/minio:latest', '9000, 9001', 'S3 storage + Console'],
      ['(Supabase Cloud)', 'managed', 'pooler 6543/5432', 'PostgreSQL — không trong compose'],
    ],
    [1800, 2800, 1600, 2826],
  ),

  h3('2.10.2. Connection Supabase qua Supavisor Pooler'),
  p('Vì Supabase free tier chỉ resolve direct DB qua IPv6, ta dùng 2 pooler URL:'),
  bullet('DATABASE_URL = port 6543 (transaction pooler, ?pgbouncer=true) cho app runtime.'),
  bullet('DIRECT_URL = port 5432 (session pooler) cho Prisma migrate + raw SQL DDL.'),
  bullet('Format: postgresql://postgres.<projectref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres'),

  h3('2.10.3. Setup schema (1 lần đầu)'),
  p('Apply 4 migration SQL + seed qua psql container:'),
  code(`make db-bootstrap
# Tương đương:
docker run --rm -v "$PWD/supabase:/sql" postgres:16-alpine sh -c "
  psql \\"$DIRECT_URL\\" -f /sql/migrations/0001_init_schema.sql && \\
  psql \\"$DIRECT_URL\\" -f /sql/migrations/0002_audit_integrity.sql && \\
  psql \\"$DIRECT_URL\\" -f /sql/migrations/0003_triggers_updated_at.sql && \\
  psql \\"$DIRECT_URL\\" -f /sql/migrations/0004_search_indexes.sql && \\
  psql \\"$DIRECT_URL\\" -f /sql/seed.sql"`),

  h3('2.10.4. Nginx config (production)'),
  p('Cấu hình ép TLS 1.3, rate-limit, proxy 3 location chính:'),
  bullet('location /api/ → backend:3000 (rate-limit api_limit 20r/s + burst 40).'),
  bullet('location ~ ^/api/v1/auth/(login|register|forgot|reset)$ → siết auth_limit 5r/s.'),
  bullet('location ~ ^/(vdt-docs)/ → minio:9000 (preserve path để SigV4 verify).'),
  bullet('location / → frontend:80 (React SPA fallback index.html).'),
  bullet('HTTP port 80 → 301 redirect HTTPS port 443.'),

  h2('2.11. Kết luận và hướng phát triển'),
  p('Hệ thống VDT Zero-Trust DMS đã hoàn thiện đầy đủ 26 luồng nghiệp vụ + 7 nhóm bảo mật theo chuẩn Enterprise:'),
  bullet('25/25 page lõi + 1 bonus + 5 page bổ sung (Public Profile, Policy Guide, SSO Callback, các modal Upload Folder/Empty File/Request Unlock).'),
  bullet('Backend 12 module + 4 BullMQ worker + Casbin engine + Hash Chaining trigger.'),
  bullet('Triển khai 1-lệnh `make up` với TLS 1.3, đã verify E2E qua Supabase Cloud + MinIO SSE-S3 + Gmail SMTP thật.'),
  p('Hướng phát triển tiếp theo:'),
  bullet('Embed font Unicode (DejaVu Sans / Noto Sans) cho PDF Audit Export hiển thị tiếng Việt đầy đủ thay vì strip ASCII.'),
  bullet('Migrate sang hybrid ABAC eval-style (Casbin matcher với r.ctx.hour, r.sub.department) cho time-based + IP-based policy.'),
  bullet('Stream zip release thẳng MinIO thay vì gom buffer RAM cho file > 500MB.'),
  bullet('Refresh token rotation grace window 5-10s tránh race-condition khi 2 tab refresh đồng thời.'),
  bullet('Tích hợp Monaco Editor thật cho online editor (hiện dùng textarea đơn giản); collaborative real-time edit qua WebSocket.'),
  p('Toàn bộ source code, documentation, deployment guide, và báo cáo phân tích chi tiết đều có sẵn trong repository D:/WEB SEC/, đáp ứng đầy đủ tiêu chí Capstone VDT 2026.'),

  // ==========================================================================
  // CHƯƠNG 3 — PHỤ LỤC (Appendix)
  // ==========================================================================
  h1('CHƯƠNG 3. PHỤ LỤC'),

  h2('3.1. Phụ lục A — Bảng đặc tả API REST (28 endpoint chính)'),
  p('Toàn bộ backend NestJS expose các REST endpoint sau, tất cả prefix /api/v1. Mọi endpoint đều qua 3 global guard theo thứ tự (Lockdown503 → JwtAuth → CasbinAbac):'),

  h3('A.1. Module Auth (Luồng 1-3)'),
  table(
    [
      ['Method', 'Path', 'Body / Query', 'Response'],
      ['POST', '/auth/login', '{ email, password }', '{ accessToken, refreshToken (cookie), user }'],
      ['POST', '/auth/refresh', '(refresh cookie)', '{ accessToken, user }'],
      ['POST', '/auth/logout', '—', '{ message }'],
      ['POST', '/auth/register-request', '{ fullName, email, password, dob?, gender? }', '{ expiresIn }'],
      ['POST', '/auth/verify-register-otp', '{ email, otp }', '{ userId }'],
      ['POST', '/auth/forgot-password-request', '{ email }', '{ message } (generic)'],
      ['POST', '/auth/reset-password-confirm', '{ email, otp, newPassword }', '{ message }'],
      ['GET', '/auth/google', '—', '302 → Google OAuth consent'],
      ['GET', '/auth/google/callback', '?code=', '302 → /auth/sso-callback?token='],
    ],
    [800, 2500, 3000, 2726],
  ),

  h3('A.2. Module Profile (Luồng 5, 6)'),
  table(
    [
      ['Method', 'Path', 'Body / Query', 'Response'],
      ['GET', '/profile', '—', 'Full profile của chính user'],
      ['GET', '/profile/searchable', '?q=&limit=', 'Array<{id, fullName, email, title, department}>'],
      ['GET', '/profile/public/:userId', '—', 'Public profile (minimal)'],
      ['POST', '/profile/request-update-otp', '—', '{ message }'],
      ['PATCH', '/profile', '{ fullName?, phone?, dob?, gender?, authContext }', '{ message }'],
      ['POST', '/profile/change-password', '{ currentPassword, newPassword }', '{ message }'],
      ['GET', '/profile/sessions', '—', 'Array<SessionMeta>'],
      ['DELETE', '/profile/sessions/:sessionId', '—', '{ message }'],
      ['DELETE', '/profile/sessions/others', '—', '{ message }'],
    ],
    [800, 2800, 2700, 2726],
  ),

  h3('A.3. Module Admin (Luồng 7-9)'),
  table(
    [
      ['Method', 'Path', 'Body / Query', 'Response'],
      ['GET', '/admin/users', '?page=&limit=&search=&status=', 'PaginatedUsers'],
      ['PATCH', '/admin/users/bulk-status', '{ userIds, status, reason }', '{ message }'],
      ['PATCH', '/admin/users/bulk-attributes', '{ userIds, departmentId?, title? }', '{ message }'],
      ['GET', '/admin/users/:userId/attributes', '—', 'CurrentAttributes'],
      ['PUT', '/admin/users/:userId/attributes', '{ departmentId, title, clearanceLevel }', '{ message }'],
      ['GET', '/admin/departments', '—', 'Array<Department>'],
      ['POST', '/admin/departments', '{ name, description? }', '{ id, message }'],
      ['PATCH', '/admin/departments/:id', '{ name?, description? }', '{ message }'],
      ['DELETE', '/admin/departments/:id', '—', '{ message }'],
    ],
    [800, 2800, 2900, 2526],
  ),

  h3('A.4. Module Projects (Luồng 10-14)'),
  table(
    [
      ['Method', 'Path', 'Body / Query', 'Response'],
      ['GET', '/projects', '?page=&limit=&status=&search=', 'PaginatedProjects'],
      ['POST', '/projects', '{ name, description?, templateType?, initialMembers? }', '{ projectId, message }'],
      ['GET', '/projects/:projectId', '—', 'ProjectDetail'],
      ['PATCH', '/projects/:projectId', '{ name?, description?, status? }', '{ message }'],
      ['POST', '/projects/:projectId/restore', '—', '{ message }'],
      ['POST', '/projects/:projectId/star', '{ isStarred }', '{ message }'],
      ['GET', '/projects/:projectId/members', '—', 'Array<Member>'],
      ['GET', '/projects/:projectId/members/searchable', '?q=&limit=', 'Searchable users (exclude existing)'],
      ['POST', '/projects/:projectId/members', '{ userId, projectRole }', '{ message }'],
      ['PATCH', '/projects/:projectId/members/:userId', '{ projectRole }', '{ message }'],
      ['DELETE', '/projects/:projectId/members/:userId', '—', '{ message }'],
    ],
    [800, 2800, 2900, 2526],
  ),

  h3('A.5. Module Documents (Luồng 12, 15, 16, 18)'),
  table(
    [
      ['Method', 'Path', 'Body / Query', 'Response'],
      ['GET', '/projects/:pid/folders/:fid', '—', '{ breadcrumbs, subFolders, documents }'],
      ['POST', '/projects/:pid/folders', '{ name, parentId? }', '{ id, message }'],
      ['POST', '/projects/:pid/documents/upload', 'multipart: file, title, folderId?, securityLevel, commitMessage, documentId?', '{ documentId, versionId, message }'],
      ['GET', '/documents/:docId', '—', 'DocumentDetail (versions, lockedBy, projectId, folderId)'],
      ['GET', '/documents/:docId/versions/:vid/download', '—', '{ downloadUrl }'],
      ['GET', '/documents/:docId/versions/:vid/preview', '—', '{ previewUrl, fileType }'],
      ['POST', '/documents/:docId/versions/:vid/restore', '—', '{ newVersionId, versionNo }'],
      ['POST', '/documents/:docId/lock', '—', '{ lockedBy, expiresAt }'],
      ['POST', '/documents/:docId/lock/request-release', '{ reason }', '{ message } (email gửi đi)'],
      ['DELETE', '/documents/:docId/lock', '—', '{ message }'],
      ['DELETE', '/documents/:docId/lock/force', '—', '{ message } (PM/Admin only)'],
      ['PATCH', '/documents/:docId/lock/heartbeat', '—', '{ newExpiresAt }'],
      ['DELETE', '/documents/:docId', '—', '{ message } (soft delete)'],
      ['GET', '/documents/:docId/diff', '?v1=&v2=', '{ deltas, originalUrls, meta }'],
    ],
    [800, 2800, 2900, 2526],
  ),

  h3('A.6. Module Workflow + Releases + Policies + Security'),
  table(
    [
      ['Method', 'Path', 'Vai trò'],
      ['PATCH', '/documents/:docId/submit-review', 'Contributor gửi document đi duyệt'],
      ['POST', '/documents/:docId/review', 'PM/Reviewer APPROVE/REJECT (Luồng 17)'],
      ['POST', '/projects/:pid/releases', 'Tạo release snapshot version RELEASED'],
      ['GET', '/projects/:pid/releases/:rid/compliance', 'Bảng kiểm tuân thủ template'],
      ['POST', '/projects/:pid/releases/:rid/export', 'Yêu cầu zip release qua BullMQ'],
      ['GET', '/projects/:pid/releases/:rid/export', 'Poll trạng thái export + download URL'],
      ['GET', '/admin/policies', 'List casbin_rule rows'],
      ['POST', '/admin/policies', 'Thêm policy/grouping rule'],
      ['DELETE', '/admin/policies/:id', 'Xóa rule (nếu không locked)'],
      ['POST', '/admin/policies/simulate', 'Dry-run enforce check'],
      ['GET', '/admin/audit-logs', 'Cursor pagination + filter'],
      ['POST', '/admin/audit-logs/export', 'PDF/CSV streaming export'],
      ['GET', '/admin/security/alerts', 'List SECURITY_ALERT events'],
      ['GET', '/admin/security/verify-integrity', 'Get current scan status'],
      ['POST', '/admin/security/trigger-verify', 'Enqueue BullMQ integrity-scan job'],
      ['GET', '/admin/security/lockdown/status', 'Check Redis system:lockdown'],
      ['POST', '/admin/security/lockdown', '{ securityPin, reason } — kích hoạt'],
      ['DELETE', '/admin/security/lockdown', 'Release lockdown (PM/Admin IP whitelist)'],
    ],
    [800, 3500, 4726],
  ),

  h2('3.2. Phụ lục B — Bảng tóm tắt 8 enum types DB'),
  table(
    [
      ['Enum', 'Giá trị', 'Bảng sử dụng'],
      ['user_status', 'PENDING, ACTIVE, DISABLED', 'profiles.status'],
      ['auth_provider', 'LOCAL, GOOGLE', 'profiles.auth_provider'],
      ['clearance_level', 'PUBLIC, INTERNAL, CONFIDENTIAL', 'profiles.clearance_level + documents.security_level'],
      ['project_status', 'ACTIVE, ARCHIVED', 'projects.status'],
      ['project_role', 'PM, CONTRIBUTOR, REVIEWER, VIEWER', 'project_members.project_role'],
      ['security_level', 'PUBLIC, INTERNAL, CONFIDENTIAL', 'documents.security_level'],
      ['document_status', 'DRAFT, UNDER_REVIEW, RELEASED, LOCKED', 'documents.status (FSM)'],
      ['release_status', 'PROCESSING, VERIFIED, VIOLATED', 'releases.status'],
    ],
    [2000, 3500, 3526],
  ),

  h2('3.3. Phụ lục C — Redis key prefix (11 nhóm)'),
  p('Redis là kho dữ liệu đa nhiệm, được phân biệt qua key prefix. Mỗi prefix có TTL riêng:'),
  table(
    [
      ['Key Pattern', 'Mục đích', 'TTL'],
      ['session:<userId>:<jti>', 'Refresh token sessions', '7 ngày'],
      ['blacklist:<jti>', 'JWT bị thu hồi (logout/disable)', '15 phút'],
      ['otp:register:<email>', 'OTP đăng ký', '5 phút'],
      ['otp:forgot:<email>', 'OTP quên mật khẩu', '5 phút'],
      ['otp:profile:<userId>', 'OTP gate sửa hồ sơ', '5 phút'],
      ['abac:cache:<userId>', 'Casbin permission cache', '5 phút'],
      ['doc:lock:<docId>', 'Pessimistic lock tài liệu', '2 giờ'],
      ['lock:request:<docId>:<userId>', 'Anti-spam xin trả khóa', '1 giờ'],
      ['user:download_freq:<userId>', 'Anomaly Detection ZSET sliding window', '2 phút'],
      ['system:lockdown', 'Emergency Lockdown flag', 'Manual'],
      ['system:scan-result', 'Tamper scan result (SECURE/COMPROMISED)', 'Manual'],
      ['release:export:<releaseId>', 'URL file zip export', '1 giờ'],
      ['bull:<queue_name>:*', 'BullMQ jobs + delayed sets', 'varies'],
    ],
    [3000, 4000, 2026],
  ),

  h2('3.4. Phụ lục D — Danh sách 17 bug đã gặp + cách fix'),
  p('Trong quá trình implement, hệ thống đã gặp 17 bug technical đáng chú ý. Toàn bộ đều đã fix + verify E2E. Dưới đây liệt kê để session sau không lặp lại:'),
  table(
    [
      ['#', 'Bug', 'Cause', 'Fix'],
      ['1', 'Multer upload 0 bytes', 'Inline comment trong .env làm Number() → NaN', 'Bỏ comment inline; recreate container'],
      ['2', 'MinIO PutObject "KMS not configured"', 'SSE-S3 cần KMS key', 'MINIO_KMS_SECRET_KEY=key:<base64>'],
      ['3', 'Prisma engine missing libssl 1.1', 'Alpine OpenSSL 3', 'binaryTargets musl + apk add openssl'],
      ['4', 'Prisma enum mismatch', 'PG snake_case vs Prisma PascalCase', '@@map cho mọi enum'],
      ['5', 'nest build missing files', 'tsc incremental + deleteOutDir', 'incremental: false'],
      ['6', 'casbin-prisma-adapter peer dep', '1.7+ yêu cầu Prisma 6/7', 'Pin exact 1.6.0'],
      ['7', 'Policy delete v3 NULL vs ""', 'Casbin compare v3=" " ≠ NULL', 'Fallback Prisma delete by id'],
      ['8', 'ORDER BY id::text gây sort lex', 'PG sort TEXT lex (1,10,11,2)', 'Đổi alias rowId; ORDER BY bigint cột gốc'],
      ['9', 'Hash chain order ≠ id order', 'Trigger pick prev theo timestamp+id DESC', 'Per-row verify dùng stored previous_hash'],
      ['10', 'pdf-lib Helvetica WinAnsi 0x1ea3', 'Không có glyph "ả"', 'toAscii() strip non-Latin1'],
      ['11', 'archiver ESM import fail', '* as archiver không callable', 'import archiver from "archiver"'],
      ['12', 'pdf-parse top-level side-effect', 'Đọc file test khi require root', 'require("pdf-parse/lib/pdf-parse.js")'],
      ['13', 'docker restart không nạp env', 'restart không re-read --env-file', 'docker rm -f + docker run lại'],
      ['14', 'Vite HMR miss file events', 'Windows bind mount', 'docker restart vdt-frontend-dev'],
      ['15', 'MinIO presigned URL SignatureDoesNotMatch', 'SigV4 ký HOST khác Nginx forward', '2 S3 client (internal+publicS3)'],
      ['16', 'Google SSO bootstrap fail', 'GoogleStrategy yêu cầu clientID non-null', 'Fallback "not-configured" + GoogleAuthGuard throw 503 nếu env trống'],
      ['17', 'Supabase direct DB IPv6 only', 'Container không có IPv6 networking', 'Dùng Supavisor pooler aws-1-ap-south-1 port 6543/5432'],
    ],
    [500, 2200, 2500, 3826],
  ),

  h2('3.5. Phụ lục E — Cấu trúc thư mục dự án'),
  code(`D:/WEB SEC/
├── backend/                   # NestJS 10 + Prisma 5
│   ├── prisma/
│   │   ├── schema.prisma      # 13 model + 8 enum
│   │   └── seed.ts            # 5 user Gmail demo
│   ├── src/
│   │   ├── infra/             # @Global() — Prisma, Redis, MinIO, Casbin, Queue
│   │   ├── core/              # Guards, Interceptors, AuditService, Decorators
│   │   ├── modules/           # 12 feature modules (auth, profile, admin, projects,
│   │   │                      #  documents, workflow, releases, policies, security,
│   │   │                      #  dashboard, templates)
│   │   └── workers/           # BullMQ processors (extractor, mailer, archiver, integrity-checker)
│   └── Dockerfile             # Multi-stage build, Alpine + openssl
│
├── frontend/                  # React 18 + Vite 5 + Tailwind
│   ├── src/
│   │   ├── app/               # Router, Providers, ProtectedRoute
│   │   ├── pages/             # 25 page + 5 phụ trợ
│   │   ├── widgets/           # MainLayout
│   │   ├── features/          # Auth actions, Upload folder, Empty file
│   │   ├── entities/          # Session store (zustand persist)
│   │   └── shared/            # axiosClient, BackButton, OtpInput, PasswordStrengthMeter
│   └── Dockerfile             # Build Vite static → Nginx serve
│
├── diff-engine/               # Python FastAPI vi dịch vụ
│   ├── main.py                # difflib.SequenceMatcher
│   └── Dockerfile
│
├── supabase/
│   ├── migrations/            # 4 SQL files (init, audit_integrity, triggers, search_indexes)
│   ├── seed.sql               # 5 user Gmail + 2 dept + template SOFTWARE_DEV
│   └── optional/              # RLS + auth.users sync (Supabase Auth)
│
├── infra/
│   ├── nginx/
│   │   ├── nginx.conf         # TLS 1.3 + rate-limit + /storage proxy
│   │   └── certs/             # tls.crt + tls.key (self-signed)
│   └── minio/setup.sh         # mc mb + encrypt set sse-s3
│
├── docs/architecture/         # 26 file .md đặc tả luồng
├── reports/                   # Báo cáo Word + Slides
├── docker-compose.yml         # 7 service orchestration
├── Makefile                   # make up, make verify, make db-bootstrap
├── .env                       # Production secrets (gitignored)
├── .env.example               # Template
├── PROGRESS.md                # Tracker tiến độ + Pinned decisions
├── GUIDE.md                   # Hướng dẫn vận hành chi tiết
└── README.md                  # Quick start`),

  h2('3.6. Phụ lục F — Lệnh điều khiển toàn cục'),
  table(
    [
      ['Lệnh', 'Mục đích'],
      ['make up', 'Triển khai 1-lệnh: gen cert + .env + docker compose up -d --build'],
      ['make down', 'Dừng tất cả container (giữ volume)'],
      ['make clean', 'Dừng + xóa volume (RESET dữ liệu local: Redis + MinIO)'],
      ['make verify', 'Smoke-test: healthz + login admin + SPA index'],
      ['make build', 'Rebuild image backend + frontend'],
      ['make logs', 'Tail log realtime tất cả service'],
      ['make ps', 'Liệt kê trạng thái container'],
      ['make restart', 'Restart full stack'],
      ['make gencert', 'Sinh self-signed cert (chỉ khi chưa có)'],
      ['make db-bootstrap', 'Apply 4 migration + seed lên Supabase qua DIRECT_URL'],
      ['make db-reset', 'DROP public schema + re-apply (DESTRUCTIVE)'],
      ['make migrate', 'Prisma migrate deploy (qua DIRECT_URL)'],
      ['make seed', 'Bơm 5 user demo qua prisma db seed'],
      ['make install', 'npm install cho backend + frontend (local dev)'],
    ],
    [3000, 6026],
  ),

  h2('3.7. Phụ lục G — Credentials demo'),
  p('Toàn bộ 5 demo user mặc định cùng mật khẩu Admin@123456:'),
  table(
    [
      ['Email', 'Vai trò', 'Clearance', 'Phòng ban'],
      ['minhchoi2004@gmail.com', 'Administrator', 'CONFIDENTIAL', 'An ninh thông tin'],
      ['nguyenhuutuon2@gmail.com', 'Project Manager', 'CONFIDENTIAL', 'Khối Phát triển Phần mềm'],
      ['duccccccc123123@gmail.com', 'Developer', 'INTERNAL', 'Khối Phát triển Phần mềm'],
      ['ducngominh2k4@gmail.com', 'Senior Reviewer', 'INTERNAL', 'Khối Phát triển Phần mềm'],
      ['daudau842640@gmail.com', 'Contributor', 'INTERNAL', 'Khối Phát triển Phần mềm'],
    ],
    [2800, 1800, 1800, 2626],
  ),

  h2('3.8. Phụ lục H — Bảng tổng kết các Pinned Architecture Decisions'),
  p('14 quyết định kiến trúc đã chốt cứng, không thay đổi trừ khi user yêu cầu rõ ràng:'),
  table(
    [
      ['#', 'Quyết định', 'Lý do'],
      ['9.1', 'Casbin RBAC + keyMatchPath, KHÔNG eval-ABAC', 'Tránh break luồng Projects khi grouping per-project'],
      ['9.2', 'MinIO 2 S3 clients (internal + publicS3)', 'SigV4 ký HOST header → cần endpoint khớp'],
      ['9.3', 'BullMQ worker tách container riêng', 'OOM worker không làm chết API'],
      ['9.4', 'Diff Engine Python FastAPI riêng', 'difflib.SequenceMatcher chuẩn hơn Node alternatives'],
      ['9.5', 'audit_logs composite PK + PARTITION BY RANGE', 'Yêu cầu Partition + Hash Chain trigger'],
      ['9.6', 'Integrity verify dùng stored previous_hash', 'Concurrent insert gây id ≠ chain order'],
      ['9.7', 'Dev mode: manual docker run mount source', 'Hot reload Windows bind mount'],
      ['9.8', 'Frontend container → VITE_API_TARGET=host.docker.internal', 'Manual run backend không cùng compose network'],
      ['9.9', '.env values KHÔNG inline #comment sau giá trị số', 'Number() ra NaN → multer truncate'],
      ['9.10', 'Source: backend/, frontend/, diff-engine/. Vdt-demo cũ ignore', 'Branch cũ không liên quan'],
      ['9.11', 'JWT cookie + Bearer; Google SSO fallback "not-configured"', 'Bootstrap không crash khi env trống'],
      ['9.12', 'pdf-lib toAscii() strip non-Latin1', 'WinAnsi không có glyph Unicode VN'],
      ['9.13', 'Prisma binaryTargets musl + @@map enum + incremental:false', 'Alpine + PG snake_case + tsc bug'],
      ['9.14', 'Vite HMR Windows quirk: docker restart workaround', 'Không migrate sang polling (CPU)'],
      ['9.0', 'Database = Supabase Cloud Pooler (KHÔNG container postgres)', 'Direct DB IPv6 only; pooler IPv4-ready'],
    ],
    [600, 4000, 4426],
  ),

  // Kết thúc
  emptyLine(),
  emptyLine(),
  p('— HẾT BÁO CÁO —', { align: AlignmentType.CENTER, italic: true, size: 26 }),
  p('VDT Zero-Trust Document Management System', { align: AlignmentType.CENTER, italic: true, size: 22 }),
  p('Capstone Project — Viettel Digital Talent 2026', { align: AlignmentType.CENTER, italic: true, size: 22 }),
];

// ============================================================================
// BUILD DOCUMENT
// ============================================================================
const doc = new Document({
  creator: 'VDT Capstone 2026',
  title: 'VDT Zero-Trust DMS — Báo cáo Phân tích Nghiệp vụ & Thiết kế',
  description: 'Báo cáo capstone Viettel Digital Talent 2026',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: FONT, color: '004D40' },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: FONT, color: '00695C' },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: '00796B' },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '004D40' } },
          children: [
            new TextRun({ text: 'VDT Zero-Trust DMS — Báo cáo Capstone 2026', font: FONT, size: 18, italics: true, color: '666666' }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Trang ', font: FONT, size: 18, color: '666666' }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '666666' }),
            new TextRun({ text: ' / ', font: FONT, size: 18, color: '666666' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: '666666' }),
          ],
        })],
      }),
    },
    children: [
      ...cover,
      ...toc,
      ...chapter1,
      ...chapter2,
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('./BaoCao_VDT_DMS.docx', buffer);
  console.log('✓ Báo cáo Word tạo xong: D:/WEB SEC/reports/BaoCao_VDT_DMS.docx');
  console.log(`  File size: ${(buffer.length / 1024).toFixed(2)} KB`);
});
