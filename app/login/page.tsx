"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLogin } from "@/components/auth/use-login";

// S1 · Đăng nhập NHÂN VIÊN — tối ưu cho điện thoại (nền gradient toàn màn,
// logo ở giữa, form nằm trong "bottom sheet" trắng bo góc trên).
// Trên web (md+) gom logo + form sát nhau và căn giữa màn để không bị hở khoảng trống.
export default function EmployeeLoginPage() {
  const { email, setEmail, password, setPassword, error, loading, locked, onSubmit } = useLogin();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-primary to-brand md:justify-center md:py-10">
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col md:w-[400px] md:max-w-none md:flex-none">
        {/* Khối thương hiệu — chiếm phần trên (mobile), gọn lại & sát form (web) */}
        <div className="flex flex-1 flex-col items-center justify-center px-7 py-8 text-center text-white md:mb-6 md:flex-none md:py-2">
          <div className="rounded-[16px] bg-white px-5 py-3 shadow-card">
            <Image
              src="https://5sao.com.vn/images/common/5sao-logo-new.svg"
              alt="5Sao"
              width={96}
              height={32}
              unoptimized
            />
          </div>
          <div className="mt-5 text-xl font-black">Hệ thống Nội bộ</div>
          <div className="mt-1.5 text-sm text-white/[.78]">Đăng nhập để chấm công</div>
        </div>

        {/* Form — "bottom sheet" trên mobile, thẻ bo tròn trên web */}
        <form
          onSubmit={onSubmit}
          className="rounded-t-[26px] bg-surface px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-7 shadow-[0_-8px_30px_rgba(22,52,94,.12)] md:rounded-[20px] md:pb-8 md:shadow-card"
        >
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
            inputMode="email"
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

          {error && <div className="mb-3 text-[12px] text-tint-tx-danger">⚠ {error}</div>}

          <Button type="submit" size="block" disabled={loading} className="mt-2">
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>

          <div className="mt-5 text-center text-[12.5px] text-muted">
            Bạn là quản trị?{" "}
            <a href="/admin" className="font-semibold text-primary">
              Đăng nhập quản trị
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
