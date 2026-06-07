-- ===========================================================================
-- VDT Zero-Trust DMS — 0003 Trigger updated_at
-- Tự động cập nhật documents.updated_at mỗi khi có thay đổi (tài liệu: "dùng Supabase Trigger").
-- ===========================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
