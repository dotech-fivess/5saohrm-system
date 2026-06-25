"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  Users,
  CalendarOff,
  Settings,
  Bell,
  Search,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type Role } from "@/lib/types";

const NAV_ADMIN = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cham-cong", label: "Chấm công", icon: Clock },
  { href: "/nhan-su", label: "Nhân sự", icon: Users },
  { href: "/nghi-phep", label: "Nghỉ phép", icon: CalendarOff },
  { href: "/cau-hinh", label: "Cấu hình", icon: Settings },
];

const NAV_MANAGER = [
  { href: "/dashboard", label: "Tổng quan đội", icon: LayoutDashboard },
  { href: "/nghi-phep/cho-duyet", label: "Chờ tôi duyệt", icon: CalendarOff },
  { href: "/cham-cong", label: "Chấm công đội", icon: Clock },
  { href: "/nhan-su", label: "Nhân viên (phạm vi)", icon: Users },
];

const TITLE: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "Dashboard điều hành" },
  { prefix: "/cham-cong", label: "Chấm công" },
  { prefix: "/nhan-su", label: "Nhân sự" },
  { prefix: "/nghi-phep", label: "Nghỉ phép" },
  { prefix: "/cau-hinh", label: "Cấu hình" },
  { prefix: "/thong-bao", label: "Thông báo" },
  { prefix: "/ca-nhan", label: "Cá nhân" },
];

export function DesktopShell({
  role,
  fullName,
  unread = 0,
  children,
}: {
  role: Role;
  fullName: string;
  unread?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isManager = role === "quan_ly";
  const nav = isManager ? NAV_MANAGER : NAV_ADMIN;
  const title = TITLE.find((t) => pathname.startsWith(t.prefix))?.label ?? "5Sao HRM";

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  const initials = fullName
    .split(" ")
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-app">
      {/* Sidebar */}
      <aside className="flex w-[212px] flex-none flex-col bg-brand px-3.5 py-5 text-white">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <div className="flex items-center rounded-[9px] bg-white px-2.5 py-1.5">
            <Image
              src="https://5sao.com.vn/images/common/5sao-logo-new.svg"
              alt="5Sao"
              width={60}
              height={20}
              unoptimized
            />
          </div>
          <span className="text-[15px] font-extrabold tracking-wide">HRM</span>
        </div>
        <nav className="flex flex-col gap-[3px]">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13.5px]",
                  active
                    ? "bg-white/[.12] font-semibold text-white"
                    : "text-white/[.78] hover:text-white"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-white/[.12] pt-3.5">
          <div
            className={cn(
              "flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-bold",
              isManager ? "bg-accent text-brand" : "bg-primary text-white"
            )}
          >
            {initials}
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">{fullName}</div>
            <div className="text-[11.5px] text-white/60">{ROLE_LABEL[role]}</div>
          </div>
          <button
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-[8px] text-white/70 hover:bg-white/[.12] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] flex-none items-center justify-between border-b bg-surface px-[26px]">
          <div className="text-[17px] font-extrabold text-brand">{title}</div>
          <div className="flex items-center gap-3.5">
            <div className="flex w-[240px] items-center gap-2 rounded-[9px] border bg-app px-3.5 py-2 text-[13px] text-muted">
              <Search className="h-4 w-4" />
              Tìm nhân viên, đơn từ…
            </div>
            <Link href="/thong-bao" className="relative" aria-label="Thông báo">
              <Bell className="h-5 w-5 text-ink" />
              {unread > 0 && (
                <span className="absolute -right-2 -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-[26px]">{children}</main>
      </div>
    </div>
  );
}
