/* eslint-disable @typescript-eslint/no-var-requires */
// VDT Zero-Trust DMS — Slide deck 25 trang qua pptxgenjs.
// Chạy: node build-slides.js  → ./Slides_VDT_DMS.pptx
const pptxgen = require('pptxgenjs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.3" × 7.5"
pres.author = 'VDT Capstone 2026';
pres.title = 'VDT Zero-Trust DMS';
pres.subject = 'Capstone Demo';
pres.company = 'Viettel Digital Talent';

// ============================================================================
// THEME
// ============================================================================
const NAVY = '0F2A4D';        // Primary
const RED = 'E60012';         // Viettel red accent
const TEAL = '14B8A6';        // Highlight green-teal
const LIGHT = 'F8FAFC';       // Light background
const DARK_TEXT = '1E293B';
const MUTED = '64748B';
const WHITE = 'FFFFFF';

// Layout helpers
const W = 13.333;
const H = 7.5;

function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  return s;
}
function lightSlide() {
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  return s;
}

// Common header strip (light slides)
function header(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.5, y: 0.4, w: W - 1, h: 0.7,
    fontSize: 30, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 1.05, w: W - 1, h: 0.4,
      fontSize: 16, italic: true, color: MUTED, fontFace: 'Calibri', margin: 0,
    });
  }
  // Small red accent square — visual motif
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.45, w: 0.08, h: 0.5,
    fill: { color: RED }, line: { color: RED },
  });
}

function footer(slide, num) {
  slide.addText(`VDT Zero-Trust DMS  ·  Capstone 2026  ·  Slide ${num}/25`, {
    x: 0.5, y: H - 0.4, w: W - 1, h: 0.3,
    fontSize: 10, color: MUTED, align: 'center', fontFace: 'Calibri',
  });
}

// ============================================================================
// SLIDE 1 — Title
// ============================================================================
{
  const s = darkSlide();
  // Red accent bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.3, h: H, fill: { color: RED }, line: { color: RED },
  });
  s.addText('VIETTEL DIGITAL TALENT 2026', {
    x: 1, y: 1.3, w: 11, h: 0.5,
    fontSize: 18, color: RED, bold: true, fontFace: 'Calibri', charSpacing: 4,
  });
  s.addText('Capstone Project — Demo Final', {
    x: 1, y: 1.85, w: 11, h: 0.4,
    fontSize: 14, italic: true, color: 'CADCFC', fontFace: 'Calibri',
  });

  s.addText('VDT Zero-Trust', {
    x: 1, y: 2.7, w: 11, h: 1,
    fontSize: 60, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  s.addText('Document Management System', {
    x: 1, y: 3.65, w: 11, h: 0.8,
    fontSize: 36, bold: true, color: WHITE, fontFace: 'Calibri',
  });

  s.addShape(pres.shapes.LINE, {
    x: 1, y: 4.8, w: 4, h: 0,
    line: { color: RED, width: 3 },
  });
  s.addText('Hệ thống quản lý tài liệu dự án theo mô hình Zero-Trust', {
    x: 1, y: 5, w: 11, h: 0.5,
    fontSize: 18, color: 'CADCFC', italic: true, fontFace: 'Calibri',
  });
  s.addText('SSE-S3  ·  ABAC + Casbin  ·  Hash Chaining  ·  TLS 1.3', {
    x: 1, y: 5.5, w: 11, h: 0.4,
    fontSize: 14, color: TEAL, fontFace: 'Consolas',
  });

  s.addText('Phiên bản 1.0  —  06/2026', {
    x: 1, y: H - 1, w: 11, h: 0.4,
    fontSize: 12, color: MUTED, fontFace: 'Calibri',
  });
}

// ============================================================================
// SLIDE 2 — Outline
// ============================================================================
{
  const s = lightSlide();
  header(s, 'Nội dung trình bày', '8 phần · ~15 phút demo');

  const outline = [
    { num: '01', title: 'Bối cảnh và Vấn đề', desc: 'SSOT, phân quyền, tampering' },
    { num: '02', title: 'Mục tiêu Hệ thống', desc: '6 mục tiêu Zero-Trust' },
    { num: '03', title: 'Kiến trúc + Tech Stack', desc: '4 lớp, 13 công nghệ' },
    { num: '04', title: '26 Luồng Nghiệp vụ', desc: 'Auth, Project, Doc, Security' },
    { num: '05', title: 'Cơ chế Bảo mật', desc: 'ABAC, Hash Chain, SSE-S3' },
    { num: '06', title: 'Workflow & Microservice', desc: 'FSM, Diff Engine, BullMQ' },
    { num: '07', title: 'Triển khai 1-lệnh', desc: 'Docker Compose, Supabase' },
    { num: '08', title: 'Kết luận & Q&A', desc: 'NFR đạt, hướng phát triển' },
  ];

  outline.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.7 + col * 6.2;
    const y = 1.7 + row * 1.3;

    // Number badge
    s.addShape(pres.shapes.OVAL, {
      x, y: y + 0.05, w: 0.8, h: 0.8,
      fill: { color: RED }, line: { color: RED },
    });
    s.addText(item.num, {
      x, y: y + 0.05, w: 0.8, h: 0.8,
      fontSize: 22, bold: true, color: WHITE, align: 'center', valign: 'middle',
      fontFace: 'Calibri', margin: 0,
    });

    // Title + desc
    s.addText(item.title, {
      x: x + 1, y, w: 5, h: 0.45,
      fontSize: 18, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(item.desc, {
      x: x + 1, y: y + 0.5, w: 5, h: 0.4,
      fontSize: 13, color: MUTED, fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 2);
}

// ============================================================================
// SLIDE 3 — Bối cảnh
// ============================================================================
{
  const s = lightSlide();
  header(s, '01 · Bối cảnh và Vấn đề', 'Quản lý tài liệu dự án trong tập đoàn lớn');

  // Left: 3 problem cards
  const problems = [
    {
      icon: '🔀',
      title: 'Mất Single Source of Truth',
      desc: 'Cùng 1 tài liệu phát tán dưới nhiều tên trên Google Drive cá nhân, email, chat...',
    },
    {
      icon: '🔓',
      title: 'Không kiểm soát phân quyền',
      desc: 'Tài liệu CONFIDENTIAL có thể bị tải bởi user không đủ clearance; không có audit chống chối bỏ.',
    },
    {
      icon: '⚠️',
      title: 'Không phát hiện tampering',
      desc: 'Kẻ tấn công có quyền DB có thể sửa lén audit log mà không có cơ chế cảnh báo.',
    },
  ];

  problems.forEach((p, i) => {
    const y = 1.7 + i * 1.55;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y, w: 6, h: 1.35,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 8, offset: 2, color: '000000', opacity: 0.08, angle: 135 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y, w: 0.08, h: 1.35, fill: { color: RED }, line: { color: RED },
    });
    s.addText(p.icon, { x: 0.95, y: y + 0.1, w: 0.7, h: 0.7, fontSize: 30, valign: 'middle', margin: 0 });
    s.addText(p.title, {
      x: 1.7, y: y + 0.15, w: 4.9, h: 0.4,
      fontSize: 16, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(p.desc, {
      x: 1.7, y: y + 0.6, w: 4.9, h: 0.7,
      fontSize: 12, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
  });

  // Right: big quote
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.5, y: 1.7, w: 5.3, h: 4.9,
    fill: { color: NAVY }, line: { color: NAVY },
  });
  s.addText('"', {
    x: 7.7, y: 1.7, w: 1, h: 1.5,
    fontSize: 100, color: RED, bold: true, fontFace: 'Georgia',
  });
  s.addText(
    'Hệ thống cần một SSOT chính thức + Zero-Trust enforcement + Tamper-evident audit để giải quyết đồng thời 3 vấn đề trên.',
    {
      x: 8, y: 3, w: 4.7, h: 2.5,
      fontSize: 18, color: WHITE, italic: true, fontFace: 'Georgia', valign: 'top',
    },
  );
  s.addText('— Yêu cầu nghiệp vụ', {
    x: 8, y: 5.5, w: 4.7, h: 0.4,
    fontSize: 13, color: TEAL, fontFace: 'Calibri',
  });

  footer(s, 3);
}

// ============================================================================
// SLIDE 4 — Mục tiêu
// ============================================================================
{
  const s = lightSlide();
  header(s, '02 · Mục tiêu Hệ thống', '6 trụ cột Zero-Trust');

  const goals = [
    { icon: '📋', title: 'SSOT', desc: 'Lifecycle DRAFT → UNDER_REVIEW → RELEASED → ARCHIVED' },
    { icon: '🛡️', title: 'Zero-Trust', desc: 'Mọi request qua JWT + ABAC bất kể nguồn gốc' },
    { icon: '🔐', title: 'SSE-S3 AES-256', desc: 'Mã hóa server-side cho mọi file (NFR-1.2)' },
    { icon: '⛓️', title: 'Hash Chain', desc: 'Audit logs SHA-256 chuỗi xích + append-only' },
    { icon: '🚀', title: '1-lệnh deploy', desc: 'Docker Compose 7 service (NFR-3.2)' },
    { icon: '✅', title: 'FSM Workflow', desc: 'Approve/Reject + Append-only versioning' },
  ];

  goals.forEach((g, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.7 + col * 4.15;
    const y = 1.7 + row * 2.4;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 3.95, h: 2.15,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 8, offset: 2, color: '000000', opacity: 0.08, angle: 135 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.3, y: y + 0.3, w: 0.9, h: 0.9,
      fill: { color: NAVY }, line: { color: NAVY },
    });
    s.addText(g.icon, {
      x: x + 0.3, y: y + 0.3, w: 0.9, h: 0.9,
      fontSize: 30, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(g.title, {
      x: x + 1.3, y: y + 0.35, w: 2.5, h: 0.5,
      fontSize: 19, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(g.desc, {
      x: x + 0.3, y: y + 1.3, w: 3.4, h: 0.75,
      fontSize: 12, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 4);
}

// ============================================================================
// SLIDE 5 — Kiến trúc 4 lớp
// ============================================================================
{
  const s = lightSlide();
  header(s, '03a · Kiến trúc 4 lớp', 'Modular Monolith hướng Event-Driven');

  const layers = [
    { name: 'CLIENT', tech: 'React 18 + Vite + Tailwind', color: TEAL, y: 1.7 },
    { name: 'GATEWAY', tech: 'Nginx 1.27 — TLS 1.3 + rate-limit', color: NAVY, y: 2.95 },
    { name: 'APPLICATION', tech: 'NestJS 10 (api + worker) + Python FastAPI', color: RED, y: 4.2 },
    { name: 'DATA', tech: 'Supabase PostgreSQL + Redis + MinIO', color: '7C3AED', y: 5.45 },
  ];

  layers.forEach((layer, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 1, y: layer.y, w: 11.3, h: 1.1,
      fill: { color: layer.color }, line: { color: layer.color },
      shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.15, angle: 135 },
    });
    s.addText(layer.name, {
      x: 1.2, y: layer.y + 0.15, w: 3, h: 0.5,
      fontSize: 24, bold: true, color: WHITE, fontFace: 'Calibri', margin: 0,
    });
    s.addText(layer.tech, {
      x: 1.2, y: layer.y + 0.6, w: 10.5, h: 0.45,
      fontSize: 14, color: WHITE, italic: true, fontFace: 'Calibri', margin: 0,
    });

    // Arrows between layers
    if (i < layers.length - 1) {
      s.addShape(pres.shapes.LINE, {
        x: 6.65, y: layer.y + 1.1, w: 0, h: 0.15,
        line: { color: MUTED, width: 2, endArrowType: 'triangle' },
      });
    }
  });

  footer(s, 5);
}

// ============================================================================
// SLIDE 6 — Tech Stack
// ============================================================================
{
  const s = lightSlide();
  header(s, '03b · Tech Stack', '13 công nghệ cốt lõi');

  const tech = [
    { layer: 'Frontend', items: 'React 18 · Vite 5 · TypeScript · Tailwind 3 · zustand · react-query' },
    { layer: 'Backend', items: 'NestJS 10 · Prisma 5 · Node-Casbin · BullMQ 5 · AWS SDK v3' },
    { layer: 'Database', items: 'PostgreSQL 16 (Supabase) · Partition + Trigger + JSONB' },
    { layer: 'Storage', items: 'MinIO S3-compatible · SSE-S3 AES-256 · Presigned URL' },
    { layer: 'Cache/Queue', items: 'Redis 7 · BullMQ 4 queues (extract / mailer / archive / scan)' },
    { layer: 'Microservice', items: 'Python 3.11 + FastAPI + difflib (Diff Engine)' },
    { layer: 'Gateway', items: 'Nginx 1.27-alpine · TLS 1.3 enforced · 2 rate-limit zones' },
    { layer: 'DevOps', items: 'Docker Compose v2 · Self-signed cert · Makefile' },
  ];

  // 2-column layout
  tech.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.7 + col * 6.15;
    const y = 1.7 + row * 1.2;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 5.95, h: 1.0,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.1, h: 1.0, fill: { color: TEAL }, line: { color: TEAL },
    });
    s.addText(t.layer, {
      x: x + 0.3, y: y + 0.1, w: 5.5, h: 0.4,
      fontSize: 15, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(t.items, {
      x: x + 0.3, y: y + 0.5, w: 5.5, h: 0.45,
      fontSize: 11, color: DARK_TEXT, fontFace: 'Consolas', margin: 0,
    });
  });

  footer(s, 6);
}

// ============================================================================
// SLIDE 7 — Mô hình dữ liệu (ERD overview)
// ============================================================================
{
  const s = lightSlide();
  header(s, '03c · Mô hình Dữ liệu (ERD)', '13 bảng + 8 enum + 12 partition audit_logs');

  const tables = [
    { name: 'departments', rel: 'Master phòng ban', x: 0.6, y: 1.7 },
    { name: 'profiles', rel: '5 user · ABAC attrs', x: 4.7, y: 1.7 },
    { name: 'casbin_rule', rel: 'ABAC engine policies', x: 8.8, y: 1.7 },
    { name: 'projects', rel: 'Dự án · status FSM', x: 0.6, y: 2.9 },
    { name: 'project_members', rel: 'N-N composite PK', x: 4.7, y: 2.9 },
    { name: 'user_project_pref', rel: 'Ghim dự án', x: 8.8, y: 2.9 },
    { name: 'folders', rel: 'Self-recursive parent', x: 0.6, y: 4.1 },
    { name: 'documents', rel: 'Pessimistic Lock', x: 4.7, y: 4.1 },
    { name: 'document_versions', rel: 'Append-only history', x: 8.8, y: 4.1 },
    { name: 'releases', rel: 'Immutable snapshot', x: 0.6, y: 5.3 },
    { name: 'project_templates', rel: 'Master template', x: 4.7, y: 5.3 },
    { name: 'template_folders', rel: 'Path Materialization', x: 8.8, y: 5.3 },
  ];

  tables.forEach((t) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: t.x, y: t.y, w: 3.9, h: 1.05,
      fill: { color: WHITE }, line: { color: NAVY, width: 1.5 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: t.x, y: t.y, w: 3.9, h: 0.4, fill: { color: NAVY }, line: { color: NAVY },
    });
    s.addText(t.name, {
      x: t.x + 0.1, y: t.y, w: 3.7, h: 0.4,
      fontSize: 12, bold: true, color: WHITE, fontFace: 'Consolas', margin: 0,
    });
    s.addText(t.rel, {
      x: t.x + 0.1, y: t.y + 0.45, w: 3.7, h: 0.55,
      fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
  });

  // Special: audit_logs partitioned
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 6.5, w: 12.1, h: 0.7,
    fill: { color: RED }, line: { color: RED },
  });
  s.addText('audit_logs (PARTITION BY RANGE)  ·  12 monthly partitions  ·  Hash Chain trigger  ·  Append-only', {
    x: 0.7, y: 6.5, w: 11.9, h: 0.7,
    fontSize: 13, bold: true, color: WHITE, valign: 'middle', fontFace: 'Consolas', margin: 0,
  });

  footer(s, 7);
}

// ============================================================================
// SLIDE 8 — 26 luồng overview
// ============================================================================
{
  const s = lightSlide();
  header(s, '04 · 26 Luồng Nghiệp vụ', '25 cốt lõi + 1 bonus, chia 5 nhóm');

  const groups = [
    { num: '01-06', name: 'IDENTITY ACCESS', count: 6, items: 'Login · Register · Forgot · Dashboard · Profile · Security', color: TEAL },
    { num: '07-09', name: 'IAM ADMIN', count: 3, items: 'User Directory · Attribute Assignment · Departments', color: NAVY },
    { num: '10-14', name: 'WORKSPACE & PROJECT', count: 5, items: 'Portfolio · Create · Folder · Team · Settings', color: '7C3AED' },
    { num: '15-20', name: 'DOCUMENT CONTROL', count: 6, items: 'Upload · Detail · Review · Diff · Release · Compliance', color: RED },
    { num: '21-25', name: 'SECURITY & COMPLIANCE', count: 5, items: 'Policy · Builder · Audit Ledger · Export · Tamper Hub', color: 'F59E0B' },
    { num: '26', name: 'BONUS — TEMPLATES', count: 1, items: 'Project Templates Master · Path Materialization', color: TEAL },
  ];

  groups.forEach((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2;
    const y = 1.7 + row * 1.7;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 6.05, h: 1.5,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.08, angle: 135 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 1.3, h: 1.5, fill: { color: g.color }, line: { color: g.color },
    });
    s.addText(g.num, {
      x: x + 0.05, y: y + 0.1, w: 1.2, h: 0.5,
      fontSize: 18, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    s.addText(`Luồng ${g.count}`, {
      x: x + 0.05, y: y + 0.65, w: 1.2, h: 0.4,
      fontSize: 12, color: WHITE, italic: true, align: 'center', fontFace: 'Calibri', margin: 0,
    });

    s.addText(g.name, {
      x: x + 1.45, y: y + 0.1, w: 4.55, h: 0.4,
      fontSize: 14, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0, charSpacing: 1,
    });
    s.addText(g.items, {
      x: x + 1.45, y: y + 0.55, w: 4.55, h: 0.85,
      fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 8);
}

// ============================================================================
// SLIDE 9 — Nhóm 1+2: Identity & IAM
// ============================================================================
{
  const s = lightSlide();
  header(s, '04a · Nhóm 1+2 — Identity Access + IAM Admin', '9 luồng (01-09)');

  const flows = [
    ['01', 'Đăng nhập hợp nhất', 'JWT + Google SSO + brute-force lock 60s'],
    ['02', 'Đăng ký nhân viên', 'OTP 6 chữ số + Strong password regex + status PENDING'],
    ['03', 'Quên mật khẩu', 'OTP + revoke all sessions + generic message chống enumeration'],
    ['04', 'Dashboard', 'Stat cards · doc đang giữ khóa · trả khóa inline'],
    ['05', 'Hồ sơ cá nhân', 'Password Gate Modal · 3 fail → lock 60s · Adaptive Auth LOCAL/GOOGLE'],
    ['06', 'An toàn tài khoản', 'Change password · Session list · Panic Button revoke others'],
    ['07', 'User Directory', 'Filter debounce + Bulk Actions + Mass Session Eviction'],
    ['08', 'Attribute Assignment', 'Force Eviction + Audit Before/After + Clearance Escalation Warning'],
    ['09', 'Departments', 'Safe Delete Guard + 409 P2002 unique validation'],
  ];

  flows.forEach((f, i) => {
    const y = 1.65 + i * 0.58;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 12.1, h: 0.5,
      fill: { color: i % 2 === 0 ? WHITE : LIGHT }, line: { color: 'E2E8F0', width: 0.5 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: 0.7, y: y + 0.08, w: 0.35, h: 0.35,
      fill: { color: TEAL }, line: { color: TEAL },
    });
    s.addText(f[0], {
      x: 0.7, y: y + 0.08, w: 0.35, h: 0.35,
      fontSize: 11, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
    s.addText(f[1], {
      x: 1.2, y: y + 0.05, w: 3.5, h: 0.4,
      fontSize: 13, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0, valign: 'middle',
    });
    s.addText(f[2], {
      x: 4.8, y: y + 0.05, w: 7.8, h: 0.4,
      fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri', margin: 0, valign: 'middle',
    });
  });

  footer(s, 9);
}

// ============================================================================
// SLIDE 10 — Nhóm 3+4: Workspace + Documents
// ============================================================================
{
  const s = lightSlide();
  header(s, '04b · Nhóm 3+4 — Workspace + Document Control', '11 luồng (10-20)');

  const flows = [
    ['10', 'Project Portfolio', 'Card grid · role/status badge · isStarred ghim'],
    ['11', 'Khởi tạo Dự án', 'Wizard 2 bước · ACID transaction · sinh folder + Casbin grouping'],
    ['12', 'Folder Navigator', 'Breadcrumbs · subFolder 🔒/📁 · upload folder · empty file'],
    ['13', 'Project Team', 'Inline role dropdown · AddMemberModal · Self-Removal Protection'],
    ['14', 'Project Settings', 'Dirty state guard · Danger Zone Archive ("gõ tên xác nhận")'],
    ['15', 'Document Upload', 'Dropzone 2/3 · progress KB/s thật · SSE-S3 + BullMQ extract'],
    ['16', 'Document Detail', '3 tabs (Preview/Metadata/Versions) · Online editor · Lock 30s heartbeat'],
    ['17', 'Document Review', 'Split-screen · Reject ≥10 chars · Action Block Overlay'],
    ['18', 'Document Diff', 'Original ↔ Text Diff toggle · difflib SequenceMatcher'],
    ['19', 'Release Packages', 'Immutable Snapshot · compliance check BFS subtree'],
    ['20', 'Compliance Export', 'BullMQ archiver zip · Export polling presigned URL'],
  ];

  flows.forEach((f, i) => {
    const y = 1.6 + i * 0.5;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 12.1, h: 0.42,
      fill: { color: i % 2 === 0 ? WHITE : LIGHT }, line: { color: 'E2E8F0', width: 0.5 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: 0.7, y: y + 0.05, w: 0.32, h: 0.32,
      fill: { color: RED }, line: { color: RED },
    });
    s.addText(f[0], {
      x: 0.7, y: y + 0.05, w: 0.32, h: 0.32,
      fontSize: 10, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
    s.addText(f[1], {
      x: 1.15, y: y + 0.02, w: 3.5, h: 0.38,
      fontSize: 12, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0, valign: 'middle',
    });
    s.addText(f[2], {
      x: 4.7, y: y + 0.02, w: 7.9, h: 0.38,
      fontSize: 10, color: DARK_TEXT, fontFace: 'Calibri', margin: 0, valign: 'middle',
    });
  });

  footer(s, 10);
}

// ============================================================================
// SLIDE 11 — Nhóm 5+Bonus
// ============================================================================
{
  const s = lightSlide();
  header(s, '04c · Nhóm 5 + Bonus — Security/Compliance + Templates', '6 luồng (21-26)');

  const flows = [
    ['21', 'ABAC Policy Manager', 'List casbin_rule · enforceEx Simulator · matched rule highlight'],
    ['22', 'Visual Rule Builder', 'Visual Builder + live JSON preview · Casbin hot-reload sau create/delete'],
    ['23', 'Audit Ledger', 'Cursor pagination · filter time/IP/action · row expansion JSON'],
    ['24', 'Compliance Export', 'PDF + Watermark dynamic + SHA-256 footer · CSV streaming UTF-8 BOM'],
    ['25', 'Tamper Detection Hub', 'BullMQ integrity-checker · Emergency Lockdown hold 3s · banner đỏ COMPROMISED'],
    ['26', 'Project Templates (Bonus)', 'Path Materialization · cascade rename/delete · locked guard'],
  ];

  flows.forEach((f, i) => {
    const y = 1.7 + i * 0.85;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 12.1, h: 0.7,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.08, angle: 135 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 0.1, h: 0.7,
      fill: { color: i === 5 ? TEAL : 'F59E0B' }, line: { color: i === 5 ? TEAL : 'F59E0B' },
    });
    s.addShape(pres.shapes.OVAL, {
      x: 0.85, y: y + 0.15, w: 0.4, h: 0.4,
      fill: { color: NAVY }, line: { color: NAVY },
    });
    s.addText(f[0], {
      x: 0.85, y: y + 0.15, w: 0.4, h: 0.4,
      fontSize: 12, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
    s.addText(f[1], {
      x: 1.4, y: y + 0.08, w: 3.5, h: 0.3,
      fontSize: 14, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(f[2], {
      x: 1.4, y: y + 0.38, w: 11.1, h: 0.3,
      fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 11);
}

// ============================================================================
// SLIDE 12 — ABAC + Casbin
// ============================================================================
{
  const s = lightSlide();
  header(s, '05a · ABAC + Casbin Policy Engine', 'Phân quyền dựa trên thuộc tính');

  // Left: definition
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 5.8, h: 5,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addText('Câu hỏi ABAC trả lời:', {
    x: 0.85, y: 1.85, w: 5.3, h: 0.45, fontSize: 14, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText(
    'User có role X, phòng ban Y, clearance Z, có được làm action A với resource R trong project P vào lúc T không?',
    {
      x: 0.85, y: 2.35, w: 5.3, h: 1.3, fontSize: 14, italic: true, color: DARK_TEXT, fontFace: 'Georgia',
    },
  );

  s.addText('Model Casbin: RBAC + keyMatchPath', {
    x: 0.85, y: 3.7, w: 5.3, h: 0.4, fontSize: 13, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText(
    'm = g(r.sub, p.sub)\n   && keyMatchPath(r.obj, p.obj)\n   && (r.act == p.act || p.act == "*")',
    {
      x: 0.85, y: 4.1, w: 5.3, h: 1.3, fontSize: 12, color: TEAL, fontFace: 'Consolas',
    },
  );

  s.addText('Adapter Prisma → bảng casbin_rule', {
    x: 0.85, y: 5.5, w: 5.3, h: 0.4, fontSize: 13, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText(
    'Hot-reload sau mỗi addPolicy/removePolicy. Cache 5 phút TTL per user qua Redis abac:cache:<uid>.',
    {
      x: 0.85, y: 5.9, w: 5.3, h: 0.7, fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri',
    },
  );

  // Right: example rules
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.8, y: 1.7, w: 5.95, h: 5,
    fill: { color: NAVY }, line: { color: NAVY },
  });
  s.addText('Ví dụ luật thực tế', {
    x: 7, y: 1.85, w: 5.6, h: 0.4, fontSize: 14, bold: true, color: TEAL, fontFace: 'Calibri',
  });

  const rules = [
    'p, role_admin, /*, *           # toàn quyền',
    'g, <admin_uid>, role_admin     # gán user → role',
    '',
    'p, role_pm_<pid>, /api/v1/projects/<pid>/*, *',
    'g, <pm_uid>, role_pm_<pid>',
    '',
    'p, role_reviewer_<pid>, /documents/*/review, POST',
    'g, <reviewer_uid>, role_reviewer_<pid>',
    '',
    'Default Deny (FR-4.1.3): không match → DENY',
  ];
  s.addText(rules.join('\n'), {
    x: 7, y: 2.4, w: 5.6, h: 4.2,
    fontSize: 11, color: 'CADCFC', fontFace: 'Consolas',
  });

  footer(s, 12);
}

// ============================================================================
// SLIDE 13 — Hash Chaining
// ============================================================================
{
  const s = darkSlide();

  // Top dark title
  s.addText('05b · Hash Chaining Audit Logs', {
    x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 30, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  s.addText('Cơ chế chống tampering chuẩn Enterprise (FR-5.2)', {
    x: 0.5, y: 1, w: 12, h: 0.4, fontSize: 15, italic: true, color: TEAL, fontFace: 'Calibri',
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.5, w: 0.08, h: 0.5, fill: { color: RED }, line: { color: RED },
  });

  // Chain diagram
  const chainY = 2;
  for (let i = 0; i < 4; i++) {
    const x = 0.8 + i * 3;
    const isLast = i === 3;
    const label = isLast ? '...' : `Row #${i + 1}`;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: chainY, w: 2.6, h: 2,
      fill: { color: '1E3A5F' }, line: { color: TEAL, width: 1.5 },
    });
    s.addText(label, {
      x, y: chainY + 0.1, w: 2.6, h: 0.35,
      fontSize: 12, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    if (!isLast) {
      s.addText(`prev_hash: ${i === 0 ? 'NULL' : '...' + i + 'A2B'}`, {
        x: x + 0.1, y: chainY + 0.5, w: 2.4, h: 0.3, fontSize: 9, color: 'CADCFC', fontFace: 'Consolas', margin: 0,
      });
      s.addText(`action: LOGIN`, {
        x: x + 0.1, y: chainY + 0.8, w: 2.4, h: 0.3, fontSize: 9, color: 'CADCFC', fontFace: 'Consolas', margin: 0,
      });
      s.addText(`current_hash:`, {
        x: x + 0.1, y: chainY + 1.15, w: 2.4, h: 0.3, fontSize: 9, color: TEAL, bold: true, fontFace: 'Consolas', margin: 0,
      });
      s.addText(`SHA256(prev||row)`, {
        x: x + 0.1, y: chainY + 1.45, w: 2.4, h: 0.3, fontSize: 9, color: TEAL, fontFace: 'Consolas', margin: 0,
      });
    } else {
      s.addText('Chain tiếp...', {
        x: x + 0.1, y: chainY + 0.9, w: 2.4, h: 0.4,
        fontSize: 12, color: 'CADCFC', italic: true, align: 'center', fontFace: 'Calibri', margin: 0,
      });
    }

    // Arrow
    if (i < 3) {
      s.addShape(pres.shapes.LINE, {
        x: x + 2.6, y: chainY + 1, w: 0.4, h: 0,
        line: { color: RED, width: 2, endArrowType: 'triangle' },
      });
    }
  }

  // Bottom: 3 protection layers
  const layers = [
    { title: 'Hash Chaining trigger', desc: 'compute_audit_hash() tính SHA256 trước INSERT' },
    { title: 'Append-only trigger', desc: 'prevent_audit_mutation() chặn UPDATE/DELETE' },
    { title: 'BullMQ scanner', desc: 'integrity-checker keyset paginate verify mỗi 1000 row' },
  ];
  layers.forEach((l, i) => {
    const x = 0.6 + i * 4.18;
    const y = 4.7;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.05, h: 1.8,
      fill: { color: '1E3A5F' }, line: { color: NAVY, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.05, h: 0.5, fill: { color: RED }, line: { color: RED },
    });
    s.addText(`Tầng ${i + 1}`, {
      x: x + 0.15, y: y + 0.07, w: 1.5, h: 0.35,
      fontSize: 13, bold: true, color: WHITE, fontFace: 'Calibri', margin: 0,
    });
    s.addText(l.title, {
      x: x + 0.15, y: y + 0.55, w: 3.8, h: 0.45,
      fontSize: 13, bold: true, color: WHITE, fontFace: 'Calibri', margin: 0,
    });
    s.addText(l.desc, {
      x: x + 0.15, y: y + 1.05, w: 3.8, h: 0.7,
      fontSize: 11, color: 'CADCFC', fontFace: 'Calibri', margin: 0,
    });
  });

  s.addText(`VDT Zero-Trust DMS  ·  Capstone 2026  ·  Slide 13/25`, {
    x: 0.5, y: H - 0.4, w: W - 1, h: 0.3,
    fontSize: 10, color: 'CADCFC', align: 'center', fontFace: 'Calibri',
  });
}

// ============================================================================
// SLIDE 14 — SSE-S3
// ============================================================================
{
  const s = lightSlide();
  header(s, '05c · SSE-S3 AES-256 Encryption', 'Mã hóa file lưu trữ MinIO (NFR-1.2)');

  // Left: flow
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 6, h: 5,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });

  const steps = [
    { n: '1', t: 'Browser upload file qua multer memoryStorage' },
    { n: '2', t: 'Backend gọi PutObjectCommand với ServerSideEncryption: "AES256"' },
    { n: '3', t: 'MinIO mã hóa AES-256 trước khi ghi disk (KMS single-key)' },
    { n: '4', t: 'Khi download: MinIO decrypt + trả presigned URL' },
    { n: '5', t: 'Browser hit URL qua Nginx /vdt-docs/ proxy (SigV4 verified)' },
  ];

  steps.forEach((s_step, i) => {
    const y = 1.95 + i * 0.85;
    s.addShape(pres.shapes.OVAL, {
      x: 0.85, y: y + 0.05, w: 0.5, h: 0.5,
      fill: { color: NAVY }, line: { color: NAVY },
    });
    s.addText(s_step.n, {
      x: 0.85, y: y + 0.05, w: 0.5, h: 0.5,
      fontSize: 16, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
    s.addText(s_step.t, {
      x: 1.5, y: y, w: 4.95, h: 0.65,
      fontSize: 12, color: DARK_TEXT, valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
  });

  // Right: verify code + benefit
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.95, y: 1.7, w: 5.8, h: 2.4,
    fill: { color: '0F172A' }, line: { color: '0F172A' },
  });
  s.addText('Verify mã hóa thực sự:', {
    x: 7.1, y: 1.8, w: 5.5, h: 0.35,
    fontSize: 12, bold: true, color: TEAL, fontFace: 'Consolas',
  });
  s.addText(
    [
      '$ docker exec vdt-minio \\',
      '   cat /data/vdt-docs/v1_*.pdf | head -c 100',
      '',
      '# Output: binary garbled — không đọc',
      '# được nội dung gốc dù copy ra ngoài',
      '',
      '$ mc encrypt info local/vdt-docs',
      '# Auto encryption "sse-s3" is enabled',
    ].join('\n'),
    {
      x: 7.1, y: 2.2, w: 5.5, h: 1.85,
      fontSize: 11, color: 'CADCFC', fontFace: 'Consolas',
    },
  );

  // Right bottom: stats
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.95, y: 4.3, w: 5.8, h: 2.4,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addText('Đặc điểm SSE-S3', {
    x: 7.1, y: 4.4, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText(
    [
      { text: '✓ AES-256-GCM authenticated encryption', options: { breakLine: true } },
      { text: '✓ KMS single-key, không cần KES standalone', options: { breakLine: true } },
      { text: '✓ Transparent — backend không phải encrypt thủ công', options: { breakLine: true } },
      { text: '✓ Bucket policy: auto-encrypt mọi PutObject', options: { breakLine: true } },
      { text: '✓ Master key (32-byte base64) lưu env MINIO_KMS_SECRET_KEY' },
    ],
    {
      x: 7.1, y: 4.8, w: 5.5, h: 1.85, fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri',
    },
  );

  footer(s, 14);
}

// ============================================================================
// SLIDE 15 — JWT + Session Eviction
// ============================================================================
{
  const s = lightSlide();
  header(s, '05d · JWT + Mass Session Eviction', 'Refresh rotation + blacklist + force logout');

  // Left: JWT flow
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 6, h: 5,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addText('Cơ chế JWT 2 tầng', {
    x: 0.8, y: 1.85, w: 5.6, h: 0.4, fontSize: 16, bold: true, color: NAVY, fontFace: 'Calibri',
  });

  const jwt = [
    ['Access Token', '15 phút, JWT trong header Bearer + cookie access_token'],
    ['Refresh Token', '7 ngày, HttpOnly cookie path=/api/v1, SameSite=Lax'],
    ['JTI Rotation', 'Mỗi refresh sinh jti mới + blacklist jti cũ qua Redis SETEX'],
    ['Mass Eviction', 'Admin disable user → DEL session:<uid>:* + SADD blacklist'],
    ['Force Logout', 'Trang Security: revoke per-session hoặc Panic Button revoke others'],
  ];
  jwt.forEach((row, i) => {
    const y = 2.4 + i * 0.85;
    s.addShape(pres.shapes.OVAL, {
      x: 0.85, y: y + 0.05, w: 0.4, h: 0.4,
      fill: { color: TEAL }, line: { color: TEAL },
    });
    s.addText(String(i + 1), {
      x: 0.85, y: y + 0.05, w: 0.4, h: 0.4,
      fontSize: 13, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
    s.addText(row[0], {
      x: 1.4, y, w: 5, h: 0.35,
      fontSize: 13, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(row[1], {
      x: 1.4, y: y + 0.35, w: 5, h: 0.4,
      fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
  });

  // Right: stats card
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.95, y: 1.7, w: 5.8, h: 2.4,
    fill: { color: NAVY }, line: { color: NAVY },
  });
  s.addText('< 1 giây', {
    x: 7, y: 1.85, w: 5.7, h: 1, fontSize: 60, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  s.addText('thời gian từ khi Admin disable đến khi user bị đá khỏi mọi tab/thiết bị', {
    x: 7.2, y: 2.95, w: 5.4, h: 0.9, fontSize: 12, italic: true, color: 'CADCFC', align: 'center', fontFace: 'Calibri',
  });

  // Right bottom: clip code
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.95, y: 4.3, w: 5.8, h: 2.4,
    fill: { color: '0F172A' }, line: { color: '0F172A' },
  });
  s.addText('Redis key prefix (đa nhiệm):', {
    x: 7.1, y: 4.4, w: 5.5, h: 0.35, fontSize: 12, bold: true, color: TEAL, fontFace: 'Consolas',
  });
  s.addText(
    [
      'session:<userId>:<jti>     TTL 7d',
      'blacklist:<jti>            TTL 15m',
      'otp:register:<email>       TTL 5m',
      'abac:cache:<userId>        TTL 5m',
      'doc:lock:<docId>           TTL 2h',
      'user:download_freq:<uid>   ZSET 60s',
      'system:lockdown            Manual',
    ].join('\n'),
    {
      x: 7.1, y: 4.8, w: 5.5, h: 1.85, fontSize: 11, color: 'CADCFC', fontFace: 'Consolas',
    },
  );

  footer(s, 15);
}

// ============================================================================
// SLIDE 16 — FSM Workflow
// ============================================================================
{
  const s = lightSlide();
  header(s, '06a · Document FSM Workflow', 'Lifecycle 4 trạng thái với transition kiểm soát chặt');

  const states = [
    { name: 'DRAFT', color: '94A3B8', x: 1, desc: 'Bản nháp · Contributor sửa' },
    { name: 'UNDER_REVIEW', color: 'F59E0B', x: 4.3, desc: 'Chờ phê duyệt · lock' },
    { name: 'RELEASED', color: '16A34A', x: 7.6, desc: 'Đã phê duyệt · SSOT' },
    { name: 'ARCHIVED', color: '94A3B8', x: 10.9, desc: 'Đóng băng · read-only' },
  ];

  states.forEach((st) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: st.x, y: 3.1, w: 2.4, h: 1.5,
      fill: { color: st.color }, line: { color: st.color },
      shadow: { type: 'outer', blur: 8, offset: 3, color: '000000', opacity: 0.2, angle: 135 },
    });
    s.addText(st.name, {
      x: st.x, y: 3.25, w: 2.4, h: 0.5,
      fontSize: 17, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    s.addText(st.desc, {
      x: st.x, y: 3.85, w: 2.4, h: 0.6,
      fontSize: 11, color: WHITE, align: 'center', valign: 'top', italic: true, fontFace: 'Calibri', margin: 0,
    });
  });

  // Arrows
  const arrows = [
    { x: 3.4, y: 3.7, w: 0.9, txt: 'submit-review', color: NAVY },
    { x: 6.7, y: 3.7, w: 0.9, txt: 'APPROVE', color: '16A34A' },
    { x: 10, y: 3.7, w: 0.9, txt: 'project Archive', color: '94A3B8' },
  ];
  arrows.forEach((ar) => {
    s.addShape(pres.shapes.LINE, {
      x: ar.x, y: ar.y, w: ar.w, h: 0,
      line: { color: ar.color, width: 2.5, endArrowType: 'triangle' },
    });
    s.addText(ar.txt, {
      x: ar.x - 0.1, y: ar.y - 0.45, w: 1.1, h: 0.35,
      fontSize: 10, bold: true, color: ar.color, align: 'center', fontFace: 'Calibri', margin: 0,
    });
  });

  // REJECT arrow loop back
  s.addShape(pres.shapes.LINE, {
    x: 6, y: 5.2, w: -1.7, h: 0,
    line: { color: RED, width: 2.5, endArrowType: 'triangle' },
  });
  s.addShape(pres.shapes.LINE, {
    x: 6, y: 4.6, w: 0, h: 0.6,
    line: { color: RED, width: 2.5 },
  });
  s.addShape(pres.shapes.LINE, {
    x: 4.3, y: 4.6, w: 0, h: 0.6,
    line: { color: RED, width: 2.5 },
  });
  s.addText('REJECT (comment ≥ 10 chars) + giải phóng lock', {
    x: 3, y: 5.4, w: 4.5, h: 0.4, fontSize: 11, bold: true, color: RED, fontFace: 'Calibri', align: 'center',
  });

  // Upload new version loop
  s.addShape(pres.shapes.LINE, {
    x: 1.7, y: 3.1, w: 0, h: -0.8,
    line: { color: NAVY, width: 2, dashType: 'dash' },
  });
  s.addShape(pres.shapes.LINE, {
    x: 1.7, y: 2.3, w: 0.5, h: 0,
    line: { color: NAVY, width: 2, dashType: 'dash', endArrowType: 'triangle' },
  });
  s.addText('upload v_new', {
    x: 1.85, y: 2, w: 2, h: 0.3, fontSize: 10, italic: true, color: NAVY, fontFace: 'Calibri',
  });

  // Bottom: rules
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 6.1, w: 12.1, h: 1,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addText('Quy tắc kiểm soát transition (backend-enforced):', {
    x: 0.85, y: 6.18, w: 11.6, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText(
    '• Chỉ Contributor/PM được submit-review  ·  • Chỉ Reviewer/PM được Approve/Reject  ·  • RELEASED chỉ project ARCHIVED mới thành ARCHIVED  ·  • Upload version mới → quay về DRAFT',
    {
      x: 0.85, y: 6.5, w: 11.6, h: 0.55, fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri',
    },
  );

  footer(s, 16);
}

// ============================================================================
// SLIDE 17 — Diff Engine
// ============================================================================
{
  const s = lightSlide();
  header(s, '06b · Diff Engine Microservice', 'Python FastAPI vi dịch vụ — Luồng 18');

  // Left: flow
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 12.1, h: 2.2,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addText('Pipeline so sánh 2 phiên bản tài liệu', {
    x: 0.85, y: 1.85, w: 11.6, h: 0.4, fontSize: 14, bold: true, color: NAVY, fontFace: 'Calibri',
  });

  const flowBoxes = [
    { name: 'Browser', desc: 'tick 2 ver', color: TEAL },
    { name: 'Backend', desc: 'gen 2 URL', color: NAVY },
    { name: 'MinIO', desc: 'raw_text', color: '7C3AED' },
    { name: 'Diff Engine', desc: 'difflib', color: RED },
    { name: 'Browser', desc: 'render delta', color: TEAL },
  ];
  flowBoxes.forEach((b, i) => {
    const x = 0.85 + i * 2.4;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 2.5, w: 2, h: 1.1,
      fill: { color: b.color }, line: { color: b.color },
    });
    s.addText(b.name, {
      x, y: 2.6, w: 2, h: 0.4, fontSize: 12, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    s.addText(b.desc, {
      x, y: 3, w: 2, h: 0.5, fontSize: 10, italic: true, color: WHITE, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    if (i < flowBoxes.length - 1) {
      s.addShape(pres.shapes.LINE, {
        x: x + 2, y: 3.05, w: 0.4, h: 0,
        line: { color: MUTED, width: 2, endArrowType: 'triangle' },
      });
    }
  });

  // Bottom-left: code snippet
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 4.2, w: 6, h: 2.6,
    fill: { color: '0F172A' }, line: { color: '0F172A' },
  });
  s.addText('Diff Engine (Python FastAPI)', {
    x: 0.85, y: 4.3, w: 5.7, h: 0.35, fontSize: 12, bold: true, color: TEAL, fontFace: 'Consolas',
  });
  s.addText(
    [
      'from difflib import SequenceMatcher',
      '',
      '@app.post("/diff")',
      'async def diff(req: DiffReq):',
      '    t1 = await fetch(req.url1)',
      '    t2 = await fetch(req.url2)',
      '    sm = SequenceMatcher(None, t1, t2)',
      '    ops = sm.get_opcodes()',
      '    return { deltas: ops_to_json(ops) }',
    ].join('\n'),
    {
      x: 0.85, y: 4.7, w: 5.7, h: 2, fontSize: 11, color: 'CADCFC', fontFace: 'Consolas',
    },
  );

  // Bottom-right: characteristics
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.75, y: 4.2, w: 5.95, h: 2.6,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addText('Đặc điểm', {
    x: 7, y: 4.3, w: 5.6, h: 0.35, fontSize: 14, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText(
    [
      { text: '• Keep-alive container — không spawn process per request', options: { breakLine: true } },
      { text: '• Tách dịch vụ Python vì difflib chuẩn hơn diff-match-patch Node', options: { breakLine: true } },
      { text: '• Backend gen 2 presigned URL internal (host minio:9000)', options: { breakLine: true } },
      { text: '• Diff Engine HTTP GET raw_text → so sánh → trả JSON deltas', options: { breakLine: true } },
      { text: '• Frontend toggle Original-view (iframe MinIO) ↔ Text-diff (split-view delta)' },
    ],
    {
      x: 7, y: 4.7, w: 5.6, h: 2, fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri',
    },
  );

  footer(s, 17);
}

// ============================================================================
// SLIDE 18 — BullMQ Workers
// ============================================================================
{
  const s = lightSlide();
  header(s, '06c · BullMQ Workers', '4 background queue tách container worker riêng');

  const queues = [
    { name: 'text-extraction', icon: '📑', desc: 'Bóc tách raw_text từ PDF/DOCX/MD/TXT', trigger: 'Upload tài liệu < 15MB', stack: 'pdf-parse · mammoth · raw' },
    { name: 'mailer', icon: '📧', desc: 'Gửi email OTP + kết quả review + xin trả khóa', trigger: 'Register · Approve · Reject · Lock request', stack: 'Nodemailer · Gmail SMTP' },
    { name: 'release-export', icon: '📦', desc: 'Nén zip release package', trigger: 'PM bấm Export trên Compliance page', stack: 'archiver · stream · MinIO PUT' },
    { name: 'integrity-scan', icon: '🛡️', desc: 'Verify Hash Chain audit_logs', trigger: 'Admin bấm "Quét toàn bộ" trên Tamper Hub', stack: 'Keyset paginate · SHA256 recompute' },
  ];

  queues.forEach((q, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2;
    const y = 1.7 + row * 2.5;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 6.05, h: 2.25,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 8, offset: 2, color: '000000', opacity: 0.08, angle: 135 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 6.05, h: 0.6, fill: { color: NAVY }, line: { color: NAVY },
    });
    s.addText(q.icon, {
      x: x + 0.15, y: y + 0.05, w: 0.7, h: 0.55, fontSize: 26, valign: 'middle', margin: 0,
    });
    s.addText(q.name, {
      x: x + 0.95, y: y + 0.08, w: 4.9, h: 0.5, fontSize: 18, bold: true, color: WHITE, fontFace: 'Consolas', margin: 0,
    });

    s.addText(q.desc, {
      x: x + 0.2, y: y + 0.7, w: 5.7, h: 0.5, fontSize: 12, color: NAVY, bold: true, fontFace: 'Calibri', margin: 0,
    });
    s.addText('Trigger: ' + q.trigger, {
      x: x + 0.2, y: y + 1.2, w: 5.7, h: 0.45, fontSize: 11, color: DARK_TEXT, italic: true, fontFace: 'Calibri', margin: 0,
    });
    s.addText('Stack: ' + q.stack, {
      x: x + 0.2, y: y + 1.7, w: 5.7, h: 0.45, fontSize: 11, color: TEAL, fontFace: 'Consolas', margin: 0,
    });
  });

  footer(s, 18);
}

// ============================================================================
// SLIDE 19 — Anomaly + Lockdown
// ============================================================================
{
  const s = lightSlide();
  header(s, '05e · Anomaly Detection + Emergency Lockdown', 'Phòng vệ chủ động chống lạm dụng');

  // Left: Anomaly Detection
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 6, h: 5,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 0.1, h: 5, fill: { color: 'F59E0B' }, line: { color: 'F59E0B' },
  });
  s.addText('🚨 Anomaly Detection (FR-5.3.1)', {
    x: 0.85, y: 1.85, w: 5.6, h: 0.4, fontSize: 16, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText('Sliding window 1 phút qua Redis ZSET', {
    x: 0.85, y: 2.25, w: 5.6, h: 0.35, fontSize: 12, italic: true, color: MUTED, fontFace: 'Calibri',
  });
  s.addText(
    [
      'ZADD user:download_freq:<uid>',
      '     <timestamp_ms> "<docId>:<ts>"',
      '',
      'ZREMRANGEBYSCORE user:download_freq:<uid>',
      '     0 (now - 60_000)',
      '',
      'ZCARD user:download_freq:<uid>',
      '→ count download trong 60s',
    ].join('\n'),
    {
      x: 0.85, y: 2.7, w: 5.6, h: 2, fontSize: 11, color: TEAL, fontFace: 'Consolas',
    },
  );
  s.addText('Nếu count > 10 (env ANOMALY_DOWNLOAD_THRESHOLD):', {
    x: 0.85, y: 4.85, w: 5.6, h: 0.35, fontSize: 12, bold: true, color: 'F59E0B', fontFace: 'Calibri',
  });
  s.addText(
    [
      { text: '✗ HTTP 429 Too Many Requests', options: { breakLine: true } },
      { text: '✗ INSERT audit log SECURITY_ALERT', options: { breakLine: true } },
      { text: '✗ Tamper Hub UI bắt cảnh báo realtime (polling 5s)' },
    ],
    {
      x: 0.85, y: 5.25, w: 5.6, h: 1.3, fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri',
    },
  );

  // Right: Emergency Lockdown
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.75, y: 1.7, w: 5.95, h: 5,
    fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.75, y: 1.7, w: 0.1, h: 5, fill: { color: RED }, line: { color: RED },
  });
  s.addText('🔒 Emergency Lockdown', {
    x: 7, y: 1.85, w: 5.6, h: 0.4, fontSize: 16, bold: true, color: NAVY, fontFace: 'Calibri',
  });
  s.addText('Admin Panic Button — toàn hệ thống 503', {
    x: 7, y: 2.25, w: 5.6, h: 0.35, fontSize: 12, italic: true, color: MUTED, fontFace: 'Calibri',
  });

  const lockSteps = [
    'Hold-to-confirm 3 giây trên Tamper Hub',
    'Yêu cầu PIN (env EMERGENCY_PIN) + lý do ≥10 chars',
    'Backend SET Redis system:lockdown = 1',
    'Lockdown503Guard chặn mọi request → trả 503',
    'Trừ IP whitelist (LOCKDOWN_SAFE_IP) — chỉ Admin trên IP đó',
    'Release lockdown: DELETE /lockdown từ safe IP',
  ];
  lockSteps.forEach((step, i) => {
    const y = 2.7 + i * 0.6;
    s.addShape(pres.shapes.OVAL, {
      x: 7, y: y + 0.05, w: 0.35, h: 0.35,
      fill: { color: RED }, line: { color: RED },
    });
    s.addText(String(i + 1), {
      x: 7, y: y + 0.05, w: 0.35, h: 0.35,
      fontSize: 11, bold: true, color: WHITE, align: 'center', valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
    s.addText(step, {
      x: 7.45, y, w: 5.15, h: 0.5, fontSize: 11, color: DARK_TEXT, valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 19);
}

// ============================================================================
// SLIDE 20 — Deployment
// ============================================================================
{
  const s = lightSlide();
  header(s, '07 · Triển khai 1-lệnh', 'Docker Compose v2 — NFR-3.2');

  // Top: big command
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 12.1, h: 1.3,
    fill: { color: '0F172A' }, line: { color: '0F172A' },
  });
  s.addText('$ make up', {
    x: 0.9, y: 1.8, w: 11.6, h: 0.7, fontSize: 36, bold: true, color: TEAL, fontFace: 'Consolas',
  });
  s.addText('# auto: gen TLS cert + .env + docker compose up -d --build → 7 containers', {
    x: 0.9, y: 2.5, w: 11.6, h: 0.4, fontSize: 14, italic: true, color: 'CADCFC', fontFace: 'Consolas',
  });

  // 7 services grid
  const services = [
    { name: 'vdt-nginx', port: '80/443', role: 'Gateway TLS 1.3', color: NAVY },
    { name: 'vdt-frontend', port: '80', role: 'React static', color: TEAL },
    { name: 'vdt-api', port: '3000', role: 'NestJS API', color: RED },
    { name: 'vdt-worker', port: '—', role: 'BullMQ 4 queues', color: '7C3AED' },
    { name: 'vdt-diff-engine', port: '8000', role: 'Python FastAPI', color: 'F59E0B' },
    { name: 'vdt-redis', port: '6379', role: 'Cache + Queue', color: '16A34A' },
    { name: 'vdt-minio', port: '9000/9001', role: 'S3 + Console', color: '0EA5E9' },
  ];

  services.forEach((sv, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.6 + col * 3.1;
    const y = 3.3 + row * 1.65;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.95, h: 1.5,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.1, angle: 135 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.95, h: 0.4, fill: { color: sv.color }, line: { color: sv.color },
    });
    s.addText(sv.name, {
      x: x + 0.1, y: y + 0.04, w: 2.85, h: 0.35, fontSize: 13, bold: true, color: WHITE, fontFace: 'Consolas', margin: 0,
    });
    s.addText(`Port: ${sv.port}`, {
      x: x + 0.1, y: y + 0.5, w: 2.85, h: 0.35, fontSize: 11, color: MUTED, fontFace: 'Consolas', margin: 0,
    });
    s.addText(sv.role, {
      x: x + 0.1, y: y + 0.9, w: 2.85, h: 0.55, fontSize: 12, color: DARK_TEXT, bold: true, fontFace: 'Calibri', margin: 0,
    });
  });

  // Note: Supabase external
  s.addShape(pres.shapes.RECTANGLE, {
    x: 9.9, y: 4.95, w: 2.85, h: 1.5,
    fill: { color: WHITE }, line: { color: NAVY, width: 2, dashType: 'dash' },
  });
  s.addText('Supabase Cloud', {
    x: 9.95, y: 5.05, w: 2.75, h: 0.35, fontSize: 13, bold: true, color: NAVY, fontFace: 'Consolas',
  });
  s.addText('Pooler 6543', {
    x: 9.95, y: 5.45, w: 2.75, h: 0.35, fontSize: 11, color: MUTED, fontFace: 'Consolas',
  });
  s.addText('PostgreSQL managed', {
    x: 9.95, y: 5.85, w: 2.75, h: 0.55, fontSize: 12, color: DARK_TEXT, bold: true, fontFace: 'Calibri',
  });

  footer(s, 20);
}

// ============================================================================
// SLIDE 21 — NFR đã đạt
// ============================================================================
{
  const s = lightSlide();
  header(s, '08a · NFR đã đạt', '6/6 yêu cầu phi chức năng verified E2E');

  const nfrs = [
    { code: 'NFR-1.1', title: 'TLS 1.3 enforced', desc: 'Nginx ssl_protocols TLSv1.3, HSTS 2 năm, HTTP → 301 HTTPS', status: '✓ openssl s_client báo TLS_AES_256_GCM_SHA384' },
    { code: 'NFR-1.2', title: 'SSE-S3 AES-256', desc: 'MinIO KMS single-key, bucket auto-encrypt, mọi PutObject với ServerSideEncryption', status: '✓ docker exec MinIO cat raw file → binary garbled' },
    { code: 'NFR-1.3', title: 'Audit logs append-only', desc: 'PostgreSQL trigger prevent_audit_mutation chặn UPDATE/DELETE', status: '✓ Bypass cần superuser SET session_replication_role' },
    { code: 'NFR-2.2', title: 'Async diff offload', desc: 'BullMQ text-extraction queue worker container riêng', status: '✓ Upload < 15MB tự enqueue, worker bóc text 136 chars/sec' },
    { code: 'NFR-3.1', title: 'Modular Monolith', desc: '@Global InfraModule + 12 feature modules tách rời', status: '✓ Backend build & start trong 1 process, mỗi module độc lập' },
    { code: 'NFR-3.2', title: '1-command deploy', desc: 'docker compose up -d --build → 7 service, dependsOn healthcheck', status: '✓ make up → 7/7 service Up sau ~30s' },
  ];

  nfrs.forEach((n, i) => {
    const y = 1.7 + i * 0.83;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 12.1, h: 0.72,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 1.2, h: 0.72,
      fill: { color: TEAL }, line: { color: TEAL },
    });
    s.addText(n.code, {
      x: 0.6, y: y + 0.05, w: 1.2, h: 0.3, fontSize: 11, bold: true, color: WHITE, align: 'center', fontFace: 'Consolas', margin: 0,
    });
    s.addText('✓ PASS', {
      x: 0.6, y: y + 0.4, w: 1.2, h: 0.3, fontSize: 11, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    s.addText(n.title, {
      x: 2, y: y + 0.05, w: 4, h: 0.3, fontSize: 13, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(n.desc, {
      x: 2, y: y + 0.4, w: 4, h: 0.3, fontSize: 10, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
    s.addText(n.status, {
      x: 6.2, y: y + 0.1, w: 6.4, h: 0.55, fontSize: 11, color: '16A34A', italic: true, valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 21);
}

// ============================================================================
// SLIDE 22 — Demo screenshots placeholder
// ============================================================================
{
  const s = lightSlide();
  header(s, '08b · Demo Screenshots', '5 màn hình tiêu biểu — chèn ảnh thật khi present');

  const screens = [
    { name: '🛡️ Tamper Hub', desc: 'Banner SECURE/COMPROMISED + Quét toàn bộ + Lockdown' },
    { name: '⚙️ Policy Builder', desc: 'Triple-panel · Live JSON · Simulator highlight rule' },
    { name: '📊 Compliance Export', desc: 'datetime preset + scope ALL/SECURITY · PDF watermark' },
    { name: '📂 Document Detail', desc: '3 tabs · Online MD editor · Version Timeline · Diff' },
    { name: '👥 Project Team', desc: 'Inline role dropdown · AddMember Modal · Self-Removal' },
    { name: '🏠 Dashboard', desc: 'My Locks card + Trả khóa inline · TTL countdown' },
  ];

  screens.forEach((sc, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.6 + col * 4.15;
    const y = 1.7 + row * 2.6;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 3.95, h: 2.35,
      fill: { color: WHITE }, line: { color: NAVY, width: 1.5, dashType: 'dash' },
    });
    // Placeholder
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.2, y: y + 0.2, w: 3.55, h: 1.4,
      fill: { color: LIGHT }, line: { color: 'E2E8F0', width: 1 },
    });
    s.addText('[ Screenshot ]', {
      x: x + 0.2, y: y + 0.2, w: 3.55, h: 1.4,
      fontSize: 16, italic: true, color: MUTED, align: 'center', valign: 'middle', fontFace: 'Calibri', margin: 0,
    });
    // Label
    s.addText(sc.name, {
      x: x + 0.2, y: y + 1.7, w: 3.55, h: 0.3, fontSize: 13, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(sc.desc, {
      x: x + 0.2, y: y + 2.0, w: 3.55, h: 0.3, fontSize: 10, color: DARK_TEXT, italic: true, fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 22);
}

// ============================================================================
// SLIDE 23 — Tổng kết
// ============================================================================
{
  const s = lightSlide();
  header(s, '08c · Tổng kết', 'Số liệu hoàn thiện đồ án');

  // Big stat cards
  const stats = [
    { num: '26/26', label: 'Luồng nghiệp vụ', sub: '25 core + 1 bonus', color: TEAL },
    { num: '25+', label: 'Page Frontend', sub: '5 phụ trợ (Public profile, Policy guide, SSO callback...)', color: NAVY },
    { num: '12', label: 'Backend modules', sub: 'Modular Monolith NestJS', color: RED },
    { num: '7+1', label: 'Service Docker', sub: '7 compose + Supabase cloud', color: '7C3AED' },
    { num: '6/6', label: 'NFR đã đạt', sub: 'TLS/SSE/Append-only/Async/Modular/Deploy', color: '16A34A' },
    { num: '17', label: 'Bug đã fix', sub: 'Tất cả documented trong PROGRESS.md §6', color: 'F59E0B' },
    { num: '~50', label: 'API endpoints', sub: 'REST + multipart upload + streaming export', color: '0EA5E9' },
    { num: '5+', label: 'Phase Bug-fix Sprint', sub: 'A→B→C→D→E (this report)', color: RED },
  ];

  stats.forEach((st, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.6 + col * 3.1;
    const y = 1.7 + row * 2.4;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.95, h: 2.2,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 8, offset: 3, color: '000000', opacity: 0.1, angle: 135 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.95, h: 0.12, fill: { color: st.color }, line: { color: st.color },
    });
    s.addText(st.num, {
      x, y: y + 0.3, w: 2.95, h: 0.9, fontSize: 44, bold: true, color: st.color, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    s.addText(st.label, {
      x, y: y + 1.25, w: 2.95, h: 0.35, fontSize: 14, bold: true, color: NAVY, align: 'center', fontFace: 'Calibri', margin: 0,
    });
    s.addText(st.sub, {
      x: x + 0.1, y: y + 1.65, w: 2.75, h: 0.5, fontSize: 10, color: MUTED, italic: true, align: 'center', fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 23);
}

// ============================================================================
// SLIDE 24 — Hướng phát triển
// ============================================================================
{
  const s = lightSlide();
  header(s, '08d · Hướng phát triển tiếp theo', 'Roadmap sau Capstone');

  const futures = [
    {
      icon: '📝', title: 'Embed Font Unicode',
      desc: 'Nhúng DejaVu Sans / Noto Sans vào PDF Audit Export thay vì strip ASCII (hiện "ả" → "?"). Yêu cầu pdf-lib với CustomFontKit.',
    },
    {
      icon: '⏰', title: 'Hybrid ABAC eval-style',
      desc: 'Mở rộng Casbin matcher để hỗ trợ điều kiện thời gian (r.ctx.hour >= 8 && r.ctx.hour <= 18), IP whitelist, geo-location.',
    },
    {
      icon: '🚀', title: 'Streaming Zip Release',
      desc: 'Stream archiver thẳng MinIO PutObject thay vì gom buffer RAM. Quan trọng cho file release > 500MB.',
    },
    {
      icon: '🔁', title: 'Refresh Token Grace Window',
      desc: 'Cho phép 5-10s grace cho jti vừa rotation. Hiện 2 tab refresh đồng thời sẽ kích hoạt revokeAllExcept.',
    },
    {
      icon: '✨', title: 'Monaco Editor + Collab',
      desc: 'Thay textarea online editor bằng Monaco; thêm WebSocket cho real-time collaborative edit (Operational Transform).',
    },
    {
      icon: '🌐', title: 'Multi-language i18n',
      desc: 'Tách string Việt sang i18next; thêm bản tiếng Anh + Lào (nội bộ Viettel Đông Dương).',
    },
  ];

  futures.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2;
    const y = 1.7 + row * 1.7;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 6.05, h: 1.55,
      fill: { color: WHITE }, line: { color: 'E2E8F0', width: 1 },
      shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.08, angle: 135 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.2, y: y + 0.2, w: 1, h: 1, fill: { color: NAVY }, line: { color: NAVY },
    });
    s.addText(f.icon, {
      x: x + 0.2, y: y + 0.2, w: 1, h: 1,
      fontSize: 30, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(f.title, {
      x: x + 1.4, y: y + 0.2, w: 4.55, h: 0.4,
      fontSize: 16, bold: true, color: NAVY, fontFace: 'Calibri', margin: 0,
    });
    s.addText(f.desc, {
      x: x + 1.4, y: y + 0.65, w: 4.55, h: 0.8,
      fontSize: 11, color: DARK_TEXT, fontFace: 'Calibri', margin: 0,
    });
  });

  footer(s, 24);
}

// ============================================================================
// SLIDE 25 — Thank you / Q&A
// ============================================================================
{
  const s = darkSlide();

  // Big red bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.3, h: H, fill: { color: RED }, line: { color: RED },
  });

  s.addText('THANK YOU', {
    x: 1, y: 2.2, w: 11, h: 1.5,
    fontSize: 90, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  s.addText('& Q / A', {
    x: 1, y: 3.5, w: 11, h: 1,
    fontSize: 60, italic: true, color: TEAL, fontFace: 'Georgia',
  });

  s.addShape(pres.shapes.LINE, {
    x: 1, y: 4.7, w: 4, h: 0, line: { color: RED, width: 3 },
  });

  s.addText('VDT Zero-Trust Document Management System', {
    x: 1, y: 4.9, w: 11, h: 0.5,
    fontSize: 22, italic: true, color: 'CADCFC', fontFace: 'Calibri',
  });

  s.addText('Capstone Project — Viettel Digital Talent 2026', {
    x: 1, y: 5.4, w: 11, h: 0.4,
    fontSize: 15, color: 'CADCFC', fontFace: 'Calibri',
  });

  s.addText('🌐 https://localhost  ·  Demo creds: minhchoi2004@gmail.com / Admin@123456', {
    x: 1, y: 6.1, w: 11, h: 0.4,
    fontSize: 13, color: TEAL, fontFace: 'Consolas',
  });

  s.addText('📁 D:/WEB SEC/  ·  PROGRESS.md  ·  GUIDE.md  ·  reports/BaoCao_VDT_DMS.docx', {
    x: 1, y: 6.5, w: 11, h: 0.4,
    fontSize: 13, color: TEAL, fontFace: 'Consolas',
  });

  s.addText('Slide 25/25', {
    x: 1, y: H - 0.4, w: W - 2, h: 0.3,
    fontSize: 10, color: MUTED, align: 'center', fontFace: 'Calibri',
  });
}

// ============================================================================
// WRITE
// ============================================================================
pres.writeFile({ fileName: 'Slides_VDT_DMS.pptx' }).then((fileName) => {
  console.log(`✓ Slides tạo xong: ${fileName}`);
});
