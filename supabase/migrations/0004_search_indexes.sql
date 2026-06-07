-- ===========================================================================
-- VDT Zero-Trust DMS — 0004 Search Indexes (pg_trgm)
-- Hỗ trợ Global Full-Text / fuzzy search trên tên tài liệu, dự án, nhân sự.
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
  ON documents USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_projects_name_trgm
  ON projects USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm
  ON profiles USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON profiles USING gin (email gin_trgm_ops);
