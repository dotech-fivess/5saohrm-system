import { createClient } from "@supabase/supabase-js";

// Client quyền cao (service role / secret key) — CHỈ dùng phía server.
// Dùng cho tác vụ admin như tạo tài khoản Auth. Bỏ qua RLS.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Bắt cả placeholder để báo lỗi rõ ràng thay vì "Invalid API key" từ Supabase
  if (!key || /ROTATE_ME|REPLACE|YOUR-/i.test(key) || key.length < 30) {
    throw new Error(
      "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY hợp lệ (secret key của project qgylpkejerbposmjqxkp) trong .env.local."
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
