"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clock, CalendarOff, User, Bell, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_TABS = [
  { href: "/", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/cham-cong", label: "Chấm công", icon: Clock },
  { href: "/nghi-phep", label: "Nghỉ phép", icon: CalendarOff },
  { href: "/ca-nhan", label: "Cá nhân", icon: User },
];

const LOGO = "https://5sao.com.vn/images/common/5sao-logo-new.svg";

export function MobileShell({
  greeting,
  fullName,
  unread = 0,
  isDeptHead = false,
  children,
}: {
  greeting: string;
  fullName: string;
  unread?: number;
  isDeptHead?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Trưởng phòng có thêm tab "Duyệt đơn" (chèn trước tab Cá nhân)
  const TABS = isDeptHead
    ? [
        ...BASE_TABS.slice(0, 3),
        { href: "/nghi-phep/duyet-phong", label: "Duyệt đơn", icon: ClipboardCheck },
        ...BASE_TABS.slice(3),
      ]
    : BASE_TABS;
  const initials = fullName
    .split(" ")
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  // Tab active = href là prefix khớp DÀI NHẤT của pathname (dùng cho cả nav trên & dưới)
  const activeHref = TABS.filter((t) =>
    t.href === "/" ? pathname === "/" : pathname.startsWith(t.href)
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const NotifBell = (
    <Link href="/thong-bao" className="relative" aria-label="Thông báo">
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-2 -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-app md:max-w-none">
      {/* ===== Top bar (web ≥ md) — thanh điều hướng ngang ===== */}
      <header className="hidden border-b bg-surface md:block">
        <div className="mx-auto flex h-[60px] w-full max-w-[960px] items-center gap-6 px-6">
          <Link href="/" className="flex flex-none items-center gap-2">
            <Image src={LOGO} alt="5Sao" width={56} height={19} unoptimized />
            <span className="text-[15px] font-extrabold tracking-wide text-brand">HRM</span>
          </Link>
          <nav className="flex items-center gap-1">
            {TABS.map((tab) => {
              const active = tab.href === activeHref;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-[9px] px-3 py-2 text-[13.5px]",
                    active
                      ? "bg-tint-blue font-semibold text-primary"
                      : "text-neutral hover:bg-app hover:text-ink"
                  )}
                >
                  <Icon className="h-[17px] w-[17px]" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-ink">
            {NotifBell}
            <div className="flex items-center gap-2.5">
              <div className="hidden text-right leading-tight lg:block">
                <div className="whitespace-nowrap text-[13px] font-semibold text-ink">{fullName}</div>
                <div className="text-[11px] text-neutral">Nhân viên</div>
              </div>
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== Header gradient (mobile < md) ===== */}
      <header className="bg-gradient-to-b from-primary to-brand px-5 pb-6 pt-4 text-white md:hidden">
        <div className="mb-3.5 flex items-center gap-2">
          <div className="flex items-center rounded-[8px] bg-white px-2 py-1">
            <Image src={LOGO} alt="5Sao" width={54} height={18} unoptimized />
          </div>
          <span className="text-[13px] font-extrabold tracking-wide text-white/90">HRM</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] text-white/80">{greeting}</div>
            <div className="text-[18px] font-extrabold">{fullName}</div>
          </div>
          <div className="flex items-center gap-3 text-white">
            {NotifBell}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[.18] font-bold">
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* ===== Nội dung — căn cột giữa trên web ===== */}
      <main className="-mt-3 flex-1 overflow-auto p-4 md:mx-auto md:mt-0 md:w-full md:max-w-[720px] md:p-7">
        {children}
      </main>

      {/* ===== Thanh tab dưới (mobile < md) ===== */}
      <nav className="flex justify-around border-t bg-surface px-0 pb-3.5 pt-2.5 md:hidden">
        {TABS.map((tab) => {
          const active = tab.href === activeHref;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center text-center",
                active ? "text-primary" : "text-muted"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className={cn("text-[10.5px]", active && "font-semibold")}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
