-- ===========================================================================
-- VDT Zero-Trust DMS — (OPTIONAL, chỉ chạy trên Supabase) Đồng bộ auth.users -> profiles
-- Khi dùng Supabase Auth: mỗi tài khoản mới trong auth.users tự động sinh 1 dòng profiles
-- (mẫu chuẩn của Supabase). Tài khoản mới ở trạng thái PENDING, chờ Admin gán phòng ban.
--
-- LƯU Ý: Tham chiếu schema 'auth' (chỉ tồn tại trên Supabase). Áp dụng thủ công.
-- Nếu hệ thống tự quản lý auth bằng NestJS (LOCAL), KHÔNG cần file này.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, auth_provider, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    CASE
      WHEN NEW.raw_app_meta_data ->> 'provider' = 'google' THEN 'GOOGLE'::auth_provider
      ELSE 'LOCAL'::auth_provider
    END,
    'PENDING'::user_status
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- (Tùy chọn ràng buộc FK chặt: profiles.id -> auth.users(id))
-- ALTER TABLE public.profiles
--   ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
