"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Logic đăng nhập dùng chung cho cả màn Nhân viên (mobile) và Quản trị (desktop).
// Hai màn chỉ khác giao diện; mọi tài khoản đều xác thực qua đây, role quyết định
// shell sau khi vào (xem app/(app)/layout.tsx).
export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setLocked(new URLSearchParams(window.location.search).get("locked") === "1");
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("invalid login credentials")) {
        setError("Email hoặc mật khẩu không đúng.");
      } else if (m.includes("email not confirmed")) {
        setError(
          "Email chưa được xác nhận. Vào Supabase → Authentication → user → bật Confirm (hoặc tạo lại user và tick Auto Confirm)."
        );
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }
    // Điều hướng cứng để middleware có thể chặn tài khoản khóa và trang nạp lại sạch
    window.location.assign("/");
  }

  return { email, setEmail, password, setPassword, error, loading, locked, onSubmit };
}
