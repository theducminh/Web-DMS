-- ===========================================================================
-- VDT Zero-Trust DMS — 0001 Init Schema
-- Lược đồ CSDL cốt lõi cho Supabase / PostgreSQL 15.
-- Idempotent: an toàn chạy lại (IF NOT EXISTS / guard).
-- ===========================================================================

-- --- Extensions ---
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Global Full-Text / fuzzy search
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- crypt()/gen_salt() cho seed bcrypt; gen_random_uuid() là built-in PG13+

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_status     AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auth_provider   AS ENUM ('LOCAL', 'GOOGLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clearance_level AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status  AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_role    AS ENUM ('PM', 'CONTRIBUTOR', 'REVIEWER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE security_level  AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('DRAFT', 'UNDER_REVIEW', 'RELEASED', 'LOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE release_status  AS ENUM ('PROCESSING', 'VERIFIED', 'VIOLATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. departments — Phòng ban
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(100)  NOT NULL UNIQUE,
  description text,
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. profiles — Hồ sơ nhân viên (id khớp auth.users(id) nếu dùng Supabase Auth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  email           varchar(255)   NOT NULL UNIQUE,
  password_hash   varchar(255),  -- NULL nếu đăng nhập Google SSO
  full_name       varchar(100)   NOT NULL,
  display_name    varchar(100),
  dob             date,
  gender          varchar(10),
  phone           varchar(20),
  auth_provider   auth_provider  NOT NULL DEFAULT 'LOCAL',
  department_id   uuid           REFERENCES departments(id),
  title           varchar(50),
  clearance_level clearance_level NOT NULL DEFAULT 'INTERNAL',
  status          user_status    NOT NULL DEFAULT 'PENDING',
  created_at      timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);

-- ---------------------------------------------------------------------------
-- 3. casbin_rule — Luật phân quyền (casbin-prisma-adapter tự quản lý)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS casbin_rule (
  id    serial PRIMARY KEY,
  ptype varchar(100) NOT NULL,
  v0    varchar(100),  -- Subject
  v1    varchar(100),  -- Object
  v2    varchar(100),  -- Action
  v3    varchar(100),  -- Context 1 (thời gian/trạng thái)
  v4    varchar(100),  -- Context 2 (mức độ mật)
  v5    varchar(100)
);

-- ---------------------------------------------------------------------------
-- 4. projects — Dự án
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(255)   NOT NULL,
  description text,
  status      project_status NOT NULL DEFAULT 'ACTIVE',
  owner_id    uuid           NOT NULL REFERENCES profiles(id),
  created_at  timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- ---------------------------------------------------------------------------
-- 5. project_members — Thành viên & vai trò trong dự án
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      uuid         NOT NULL REFERENCES profiles(id),
  project_role project_role NOT NULL,
  assigned_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- ---------------------------------------------------------------------------
-- 6. folders — Cây thư mục dự án
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id  uuid         REFERENCES folders(id),
  name       varchar(255) NOT NULL,
  is_locked  boolean      NOT NULL DEFAULT false,
  created_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent  ON folders(parent_id);

-- ---------------------------------------------------------------------------
-- 7. documents — Quản lý file & workflow (Pessimistic Locking qua locked_by)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id                   uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid            NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id            uuid            REFERENCES folders(id),
  title                varchar(255)    NOT NULL,
  security_level       security_level  NOT NULL DEFAULT 'INTERNAL',
  status               document_status NOT NULL DEFAULT 'DRAFT',
  locked_by            uuid            REFERENCES profiles(id),
  created_by           uuid            NOT NULL REFERENCES profiles(id),
  is_deleted           boolean         NOT NULL DEFAULT false,
  published_version_id uuid,           -- phiên bản đang lưu hành (không FK cứng, tránh vòng phụ thuộc)
  created_at           timestamptz     NOT NULL DEFAULT now(),
  updated_at           timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_project    ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder     ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON documents(is_deleted);

-- ---------------------------------------------------------------------------
-- 8. document_versions — Lịch sử file vật lý (Append-only, bất biến)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_versions (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          uuid         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no           integer      NOT NULL,
  storage_key          varchar(500) NOT NULL,
  raw_text_storage_key varchar(500),
  file_type            varchar(20)  NOT NULL,
  file_size            bigint       NOT NULL,
  text_extracted       boolean      NOT NULL DEFAULT false,
  commit_message       text,
  uploaded_by          uuid         NOT NULL REFERENCES profiles(id),
  created_at           timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);

-- ---------------------------------------------------------------------------
-- 9. audit_logs — Nhật ký chống chối bỏ (Hash Chaining + Table Partitioning)
--    PARTITION BY RANGE (timestamp): chia theo tháng để không chậm khi phình to.
--    PK kép (id, timestamp) vì partition key phải thuộc khóa chính.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            bigint       GENERATED ALWAYS AS IDENTITY,
  timestamp     timestamptz  NOT NULL DEFAULT now(),
  user_id       uuid         REFERENCES profiles(id),  -- NULL được (VD: hacker dò pass)
  action        varchar(50)  NOT NULL,
  target_id     varchar(255),
  ip_address    varchar(45),
  is_success    boolean      NOT NULL DEFAULT true,
  fail_reason   text,
  metadata      jsonb,                                  -- payload before/after (thao tác admin)
  previous_hash varchar(64)  NOT NULL,
  current_hash  varchar(64)  NOT NULL,
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

-- Hàm tiện ích: tạo partition tháng theo dạng audit_logs_YYYY_MM
CREATE OR REPLACE FUNCTION create_audit_partition(p_year int, p_month int)
RETURNS void AS $$
DECLARE
  part_name text := format('audit_logs_%s_%s', p_year, lpad(p_month::text, 2, '0'));
  start_ts  date := make_date(p_year, p_month, 1);
  end_ts    date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L);',
    part_name, start_ts, end_ts
  );
END;
$$ LANGUAGE plpgsql;

-- Tạo sẵn partition cho năm 2026 (có thể gọi create_audit_partition cho tháng mới sau này)
DO $$
DECLARE m int;
BEGIN
  FOR m IN 1..12 LOOP
    PERFORM create_audit_partition(2026, m);
  END LOOP;
END $$;

-- Partition mặc định: hứng các bản ghi nằm ngoài mọi khoảng đã khai báo
CREATE TABLE IF NOT EXISTS audit_logs_default PARTITION OF audit_logs DEFAULT;

-- ---------------------------------------------------------------------------
-- 10. project_templates — Mẫu dự án
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_templates (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(100) NOT NULL UNIQUE,
  template_type varchar(50)  NOT NULL UNIQUE,
  description   text,
  is_active     boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 11. template_folders — Cấu trúc thư mục của mẫu (Path Materialization)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS template_folders (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid         NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  name          varchar(255) NOT NULL,
  parent_path   varchar(500),
  is_locked     boolean      NOT NULL DEFAULT false,
  display_order integer      NOT NULL DEFAULT 0,
  description   varchar(255)
);
CREATE INDEX IF NOT EXISTS idx_template_folders_template ON template_folders(template_id);

-- ---------------------------------------------------------------------------
-- Bảng phụ trợ
-- ---------------------------------------------------------------------------

-- releases — Gói phát hành (chốt hồ sơ)
CREATE TABLE IF NOT EXISTS releases (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid           NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  release_name     varchar(255)   NOT NULL,
  template_type    varchar(50),
  description      text,
  status           release_status NOT NULL DEFAULT 'PROCESSING',
  compliance_score integer,
  frozen_at        timestamptz,
  created_by       uuid           NOT NULL REFERENCES profiles(id),
  created_at       timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(project_id);

-- release_document_versions — Snapshot bất biến: gói release trỏ tới version cụ thể
CREATE TABLE IF NOT EXISTS release_document_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id          uuid NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  document_version_id uuid NOT NULL REFERENCES document_versions(id),
  UNIQUE (release_id, document_version_id)
);

-- user_project_preferences — Ghim dự án (Pinned Projects)
CREATE TABLE IF NOT EXISTS user_project_preferences (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  is_starred boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, project_id)
);
