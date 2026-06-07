-- ===========================================================================
-- VDT Zero-Trust DMS — Seed dữ liệu khởi tạo (idempotent)
-- Admin Root + 4 demo user (PM, Dev, Reviewer, Contributor) + Project Template.
-- Tất cả mật khẩu băm bằng bcrypt qua pgcrypto: gen_salt('bf', 10).
--
-- Demo accounts (mặc định tất cả mật khẩu = Admin@123456):
--   minhchoi2004@gmail.com         (Admin Root - CONFIDENTIAL)
--   nguyenhuutuon2@gmail.com       (Project Manager - CONFIDENTIAL)
--   duccccccc123123@gmail.com      (Developer - INTERNAL)
--   ducngominh2k4@gmail.com        (Reviewer - INTERNAL)
--   daudau842640@gmail.com         (Contributor - INTERNAL)
-- ===========================================================================

-- --- Phòng ban gốc ---
INSERT INTO departments (name, description)
VALUES
  ('An ninh thông tin',        'Trung tâm An toàn thông tin'),
  ('Khối Phát triển Phần mềm', 'Đội phát triển sản phẩm phần mềm lõi')
ON CONFLICT (name) DO NOTHING;

-- --- Admin Root ---
INSERT INTO profiles (email, password_hash, full_name, display_name, auth_provider, department_id, title, clearance_level, status)
SELECT
  'minhchoi2004@gmail.com',
  crypt('Admin@123456', gen_salt('bf', 10)),
  'Mạnh Choi',
  'Admin',
  'LOCAL',
  d.id,
  'Administrator',
  'CONFIDENTIAL',
  'ACTIVE'
FROM departments d
WHERE d.name = 'An ninh thông tin'
ON CONFLICT (email) DO NOTHING;

-- --- Project Manager ---
INSERT INTO profiles (email, password_hash, full_name, display_name, auth_provider, department_id, title, clearance_level, status)
SELECT
  'nguyenhuutuon2@gmail.com',
  crypt('Admin@123456', gen_salt('bf', 10)),
  'Nguyễn Hữu Tuấn',
  'Tuấn PM',
  'LOCAL',
  d.id,
  'Project Manager',
  'CONFIDENTIAL',
  'ACTIVE'
FROM departments d
WHERE d.name = 'Khối Phát triển Phần mềm'
ON CONFLICT (email) DO NOTHING;

-- --- Developer ---
INSERT INTO profiles (email, password_hash, full_name, display_name, auth_provider, department_id, title, clearance_level, status)
SELECT
  'duccccccc123123@gmail.com',
  crypt('Admin@123456', gen_salt('bf', 10)),
  'Đức Developer',
  'Đức Dev',
  'LOCAL',
  d.id,
  'Developer',
  'INTERNAL',
  'ACTIVE'
FROM departments d
WHERE d.name = 'Khối Phát triển Phần mềm'
ON CONFLICT (email) DO NOTHING;

-- --- Reviewer ---
INSERT INTO profiles (email, password_hash, full_name, display_name, auth_provider, department_id, title, clearance_level, status)
SELECT
  'ducngominh2k4@gmail.com',
  crypt('Admin@123456', gen_salt('bf', 10)),
  'Ngô Minh Đức',
  'Đức Reviewer',
  'LOCAL',
  d.id,
  'Senior Reviewer',
  'INTERNAL',
  'ACTIVE'
FROM departments d
WHERE d.name = 'Khối Phát triển Phần mềm'
ON CONFLICT (email) DO NOTHING;

-- --- Contributor ---
INSERT INTO profiles (email, password_hash, full_name, display_name, auth_provider, department_id, title, clearance_level, status)
SELECT
  'daudau842640@gmail.com',
  crypt('Admin@123456', gen_salt('bf', 10)),
  'Đậu Contributor',
  'Đậu',
  'LOCAL',
  d.id,
  'Contributor',
  'INTERNAL',
  'ACTIVE'
FROM departments d
WHERE d.name = 'Khối Phát triển Phần mềm'
ON CONFLICT (email) DO NOTHING;

-- --- Cấp quyền System Admin cho Admin Root qua Casbin grouping ---
INSERT INTO casbin_rule (ptype, v0, v1)
SELECT 'g', p.id::text, 'role_admin'
FROM profiles p
WHERE p.email = 'minhchoi2004@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM casbin_rule c
    WHERE c.ptype = 'g' AND c.v0 = p.id::text AND c.v1 = 'role_admin'
  );

-- role_admin toàn quyền (chỉ có hiệu lực khi bật ABAC_ENABLED; AdminGuard dùng grouping ở trên)
INSERT INTO casbin_rule (ptype, v0, v1, v2)
SELECT 'p', 'role_admin', '/*', '*'
WHERE NOT EXISTS (
  SELECT 1 FROM casbin_rule c WHERE c.ptype = 'p' AND c.v0 = 'role_admin' AND c.v1 = '/*'
);

-- --- Project Template: Dự án Phần mềm R&D ---
INSERT INTO project_templates (name, template_type, description)
VALUES ('Dự án Phần mềm R&D', 'SOFTWARE_DEV', 'Chuẩn hóa tài liệu cho các dự án phát triển phần mềm nội bộ')
ON CONFLICT (template_type) DO NOTHING;

-- --- Thư mục mẫu (chỉ chèn nếu chưa có cho template này) ---
INSERT INTO template_folders (template_id, name, parent_path, is_locked, display_order, description)
SELECT t.id, v.name, NULL, v.is_locked, v.display_order, v.description
FROM project_templates t
CROSS JOIN (VALUES
  ('01_SRS',      true,  1, 'Tài liệu đặc tả yêu cầu hệ thống'),
  ('02_Design',   true,  2, 'Tài liệu thiết kế'),
  ('03_API_Spec', true,  3, 'Đặc tả API'),
  ('04_Test',     false, 4, 'Tài liệu kiểm thử')
) AS v(name, is_locked, display_order, description)
WHERE t.template_type = 'SOFTWARE_DEV'
  AND NOT EXISTS (
    SELECT 1 FROM template_folders tf
    WHERE tf.template_id = t.id AND tf.name = v.name AND tf.parent_path IS NULL
  );
