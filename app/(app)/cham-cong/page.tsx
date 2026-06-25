import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminArea, type Profile } from "@/lib/types";
import { CheckinPanel } from "@/components/checkin-panel";
import { DayFilter } from "@/components/day-filter";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Clock, PlusCircle } from "lucide-react";

export default async function Page({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  const profile = data as Profile | null;
  const role = profile?.role ?? "nhan_vien";

  if (isAdminArea(role)) return <CompanyBoard date={searchParams.date} />;

  // Nhân viên: màn chấm công
  return (
    <div className="space-y-4">
      <CheckinPanel shiftLabel="Hành chính · 08:00–17:00" />
      <div className="flex gap-2.5">
        <Link href="/cham-cong/lich-su" className="flex-1 rounded-[13px] bg-surface p-3 text-center">
          <Clock className="mx-auto h-5 w-5 text-brand" />
          <div className="mt-1 text-[12px] font-semibold text-ink">Lịch sử</div>
        </Link>
        <Link href="/cham-cong/bo-sung" className="flex-1 rounded-[13px] bg-surface p-3 text-center">
          <PlusCircle className="mx-auto h-5 w-5 text-brand" />
          <div className="mt-1 text-[12px] font-semibold text-ink">Bổ sung công</div>
        </Link>
      </div>
    </div>
  );
}

// S13 — Bảng chấm công toàn công ty (theo ngày, mặc định hôm nay)
async function CompanyBoard({ date: dateParam }: { date?: string }) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const date = dateParam || today;
  const { data } = await supabase
    .from("attendance_records")
    .select("id, check_in_at, check_out_at, checkin_status, checkout_status, state, employee:profiles(full_name, employee_code), work_type:work_types(code)")
    .eq("work_date", date)
    .order("check_in_at", { ascending: false });

  const rows = (data ?? []) as any[];
  const onTime = rows.filter((r) => r.checkin_status === "Hợp lệ").length;
  const late = rows.filter((r) => r.checkin_status === "Trễ").length;
  const forgot = rows.filter((r) => r.state === "missing_checkout").length;

  const isToday = date === today;
  const dateLabel = new Date(date).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <DayFilter date={date} today={today} />
          <span className="text-[13px] text-neutral">
            {dateLabel}
            {isToday && <span className="ml-1 font-semibold text-brand">· Hôm nay</span>}
          </span>
        </div>
        <Link href="/cham-cong/thong-ke" className="text-[13px] font-semibold text-primary">
          Thống kê →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Chip tone="success" label="Đúng giờ" value={onTime} />
        <Chip tone="warn" label="Đi trễ" value={late} />
        <Chip tone="danger" label="Chưa check-out" value={forgot} />
        <Chip tone="blue" label="Tổng lượt" value={rows.length} />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.8fr_1fr_1fr_0.8fr_1.1fr] gap-2 border-b bg-app px-4 py-3 text-[11.5px] font-bold uppercase text-neutral">
          <span>Nhân viên</span><span>Vào</span><span>Ra</span><span>Loại</span><span>Trạng thái</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted">
            {isToday ? "Hôm nay" : "Ngày này"} chưa có lượt chấm công.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1.8fr_1fr_1fr_0.8fr_1.1fr] items-center gap-2 border-b border-divider px-4 py-3 text-[13px]">
              <span className="font-medium text-ink">{r.employee?.full_name ?? "—"}</span>
              <span className="font-mono">{hm(r.check_in_at)}</span>
              <span className="font-mono text-muted">{r.check_out_at ? hm(r.check_out_at) : "—"}</span>
              <span>{r.work_type?.code ?? "—"}</span>
              <span>
                <StatusBadge tone={r.state === "missing_checkout" ? "danger" : r.checkin_status === "Trễ" ? "warning" : "success"} dot={false}>
                  {r.state === "missing_checkout" ? "Chưa ra" : r.checkin_status}
                </StatusBadge>
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function Chip({ tone, label, value }: { tone: "success" | "warn" | "danger" | "blue"; label: string; value: number }) {
  const map: Record<string, string> = {
    success: "bg-tint-success text-tint-tx-success",
    warn: "bg-tint-warn text-tint-tx-warn",
    danger: "bg-tint-danger text-tint-tx-danger",
    blue: "bg-tint-blue text-tint-tx-blue",
  };
  return (
    <div className={"rounded-[10px] px-3.5 py-2.5 " + map[tone]}>
      <div className="text-[11.5px]">{label}</div>
      <div className="text-[20px] font-extrabold">{value}</div>
    </div>
  );
}

function hm(s: string) {
  return new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
