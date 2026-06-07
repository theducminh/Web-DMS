-- ===========================================================================
-- VDT Zero-Trust DMS — 0002 Audit Integrity
-- (1) Hash Chaining tự động ở tầng DB (chống chối bỏ — FR-5.2).
-- (2) Chặn UPDATE/DELETE trên audit_logs (Append-only — NFR-1.3).
-- ===========================================================================

-- Cho phép app INSERT mà không cần tự tính hash: trigger sẽ điền 2 cột này.
ALTER TABLE audit_logs ALTER COLUMN previous_hash SET DEFAULT '';
ALTER TABLE audit_logs ALTER COLUMN current_hash  SET DEFAULT '';

-- ---------------------------------------------------------------------------
-- (1) Hash Chaining: current_hash = SHA256(prev_hash || nội dung dòng hiện tại)
--     prev_hash = current_hash của dòng log mới nhất (hoặc 'GENESIS' nếu là dòng đầu).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_audit_hash()
RETURNS trigger AS $$
DECLARE
  prev_hash text;
  payload   text;
BEGIN
  -- Serialize việc tính hash để chuỗi xích không bị đứt do chèn đồng thời (race condition).
  PERFORM pg_advisory_xact_lock(hashtext('vdt_audit_chain'));

  SELECT current_hash INTO prev_hash
  FROM audit_logs
  ORDER BY timestamp DESC, id DESC
  LIMIT 1;

  prev_hash := COALESCE(prev_hash, 'GENESIS');

  -- Gộp các trường định danh của dòng log hiện tại
  payload := prev_hash
          || COALESCE(NEW.id::text, '')
          || COALESCE(to_char(NEW.timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), '')
          || COALESCE(NEW.user_id::text, '')
          || COALESCE(NEW.action, '')
          || COALESCE(NEW.target_id, '')
          || COALESCE(NEW.ip_address, '')
          || COALESCE(NEW.is_success::text, '')
          || COALESCE(NEW.fail_reason, '')
          || COALESCE(NEW.metadata::text, '');

  NEW.previous_hash := prev_hash;
  NEW.current_hash  := encode(digest(payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_hash ON audit_logs;
CREATE TRIGGER trg_audit_hash
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION compute_audit_hash();

-- ---------------------------------------------------------------------------
-- (2) Append-only: cấm UPDATE và DELETE trên audit_logs.
--     Bất kỳ ai (kể cả DBA dùng SQL tool) cố sửa/xóa đều bị chặn ở tầng DB.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs là Append-only: cấm % (NFR-1.3, Tamper-proof)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_logs;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_audit_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

-- Tùy chọn (môi trường thật): cấu hình role kết nối riêng cho Backend chỉ có INSERT.
-- Trên Supabase, role 'authenticated'/'service_role' đã tách biệt; ví dụ siết thêm:
--   REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
--   GRANT  INSERT, SELECT ON audit_logs TO authenticated;
