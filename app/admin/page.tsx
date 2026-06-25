"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLogin } from "@/components/auth/use-login";

// S1 · Đăng nhập QUẢN TRỊ — desktop split-screen (panel thương hiệu + form).
export default function AdminLoginPage() {
  const { email, setEmail, password, setPassword, error, loading, locked, onSubmit } = useLogin();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="flex w-full max-w-[920px] overflow-hidden rounded-card bg-surface shadow-card md:h-[540px]">
        {/* Brand panel (desktop) */}
        <div className="hidden w-[380px] flex-col justify-between bg-gradient-to-b from-primary to-brand p-11 text-white md:flex">
          <div className="inline-flex items-center self-start rounded-[12px] bg-white px-4 py-2.5">
            <Image
              src="https://5sao.com.vn/images/common/5sao-logo-new.svg"
              alt="5Sao"
              width={84}
              height={28}
              unoptimized
            />
          </div>
          <div>
            <div className="text-[28px] font-black leading-tight">
              Quản trị nội bộ
              <br />
              nhanh &amp; minh bạch.
            </div>
            <div className="mt-3.5 text-sm leading-relaxed text-white/[.78]">
              Chấm công, nghỉ phép và hồ sơ nhân sự trong một hệ thống duy nhất.
            </div>
          </div>
          <div className="text-[12.5px] text-white/60">
            © 2026 5Sao · Bảo mật &amp; phân quyền
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col justify-center p-8 md:p-14"
        >
          <div className="text-2xl font-black text-brand">Đăng nhập quản trị</div>
          <div className="mb-7 mt-1.5 text-sm text-neutral">
            Dùng email công ty và mật khẩu được cấp.
          </div>

          {locked && (
            <div className="mb-5 rounded-input border border-tint-bd-danger bg-tint-danger px-4 py-3">
              <div className="text-[13.5px] font-bold text-tint-tx-danger">🔒 Tài khoản đã bị khóa</div>
              <div className="mt-1 text-[12.5px] text-tint-tx-danger">
                Tài khoản này đang ở trạng thái Khóa nên không thể truy cập. Liên hệ Quản trị để được mở lại.
              </div>
            </div>
          )}

          <Label htmlFor="email">Email công ty</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="an.nguyen@5sao.vn"
            className="mb-4"
            required
          />

          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mb-3"
            required
          />

          {error && (
            <div className="mb-3 text-[12px] text-tint-tx-danger">⚠ {error}</div>
          )}

          <Button type="submit" size="block" disabled={loading} className="mt-2">
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>

          <div className="mt-5 text-[12.5px] text-muted">
            Bạn là nhân viên?{" "}
            <a href="/login" className="font-semibold text-primary">
              Đăng nhập nhân viên
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
