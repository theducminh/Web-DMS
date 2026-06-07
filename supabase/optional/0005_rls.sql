-- ===========================================================================
-- VDT Zero-Trust DMS — (OPTIONAL, chỉ chạy trên Supabase) Row Level Security
-- Backstop tầng DB: bật RLS để chặn truy cập trực tiếp từ role 'anon'/'authenticated'
-- qua PostgREST. Backend NestJS kết nối bằng 'service_role' (bypass RLS) và CASBIN/ABAC
-- mới là lớp phân quyền nghiệp vụ thật sự (theo thiết kế Zero-Trust).
--
-- LƯU Ý: File này tham chiếu các role riêng của Supabase (anon/authenticated/service_role)
-- nên KHÔNG nằm trong thư mục migrations auto-chạy. Áp dụng thủ công trên Supabase.
-- ===========================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'departments','profiles','casbin_rule','projects','project_members',
    'folders','documents','document_versions','audit_logs',
    'project_templates','template_folders','releases',
    'release_document_versions','user_project_preferences'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Bật RLS (mặc định DENY khi không có policy nào khớp cho anon/authenticated)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);

    -- service_role (Backend NestJS) toàn quyền — đây là cổng vào duy nhất hợp lệ.
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_service_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);',
      t || '_service_all', t
    );
  END LOOP;
END $$;

-- Tài liệu Audit chỉ cho phép service_role đọc, tuyệt đối không UPDATE/DELETE
-- (đã được chặn thêm bằng trigger ở 0002_audit_integrity.sql).
