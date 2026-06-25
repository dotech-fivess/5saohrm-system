import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/date-range";
import { isAdminArea, type Profile } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { MonthFilter } from "@/components/month-filter";
import { Clock, FileText, PlusCircle } from "lucide-react";

const ACTIONS = [
  { icon: FileText, label: "Xin nghỉ", href: "/nghi-phep/dang-ky" },
  { icon: PlusCircle, label: "Bổ sung công", href: "/cham-cong/bo-sung" },
  { icon: Clock, label: "Lịch sử", href: "/cham-cong/lich-su" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  const profile = data as Profile | null;

  // Quản trị/Quản lý → vào Dashboard
  if (isAdminArea(profile?.role ?? "nhan_vien")) redirect("/dashboard");

  // Lịch sử chấm công theo tháng đang chọn (mặc định tháng hiện tại)
  const { from, toExclusive, month, label } = resolveRange({ month: searchParams.month });
  const { data: attData } = await supabase
    .from("attendance_records")
    .select(
      "id, work_date, check_in_at, check_out_at, checkin_status, state, computed_workday, work_type:work_types(code)"
    )
    .gte("work_date", from)
    .lt("work_date", toExclusive)
    .order("work_date", { ascending: false });
  const rows = (attData ?? []) as any[];
  const ngayCong = round(rows.reduce((s, r) => s + Number(r.computed_workday || 0), 0));
  const treCount = rows.filter((r) => r.checkin_status === "Trễ").length;
  const onCount = rows.filter((r) => r.work_type?.code === "ON").length;

  return (
    <div className="space-y-3.5">
      <Card className="rounded-[16px] p-[18px] text-center shadow-mobile">
        <div className="text-[12.5px] text-neutral">Chấm công hôm nay</div>
        <Link
          href="/cham-cong"
          className="mt-3 block w-full rounded-[13px] bg-primary py-3.5 text-[16px] font-bold text-white shadow-btn"
        >
          ● Chấm công ngay
        </Link>
        <div className="mt-2 text-[11.5px] text-muted">📍 Check-in/out có định vị GPS</div>
      </Card>

      <div className="flex gap-2.5">
        {ACTIONS.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            className="flex-1 rounded-[13px] bg-surface p-3 text-center hover:bg-app"
          >
            <q.icon className="mx-auto h-5 w-5 text-brand" />
            <div className="mt-1 text-[12px] font-semibold text-ink">{q.label}</div>
          </Link>
        ))}
      </div>

      {/* Lịch sử chấm công theo tháng */}
      <Card className="rounded-[14px] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[13px] font-bold text-brand">Lịch sử chấm công</div>
          <MonthFilter month={month} />
        </div>

        <div className="mb-3 flex justify-between rounded-[12px] bg-app px-3 py-2.5">
          <Stat value={String(ngayCong)} label="Ngày công" tone="text-brand" />
          <Stat value={String(treCount)} label="Đi trễ" tone="text-tint-tx-warn" />
          <Stat value={String(onCount)} label="Online" tone="text-tint-tx-blue" />
        </div>

        {rows.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-muted">
            Chưa có dữ liệu chấm công trong {label.toLowerCase()}.
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <div className="w-9 flex-none text-center">
                  <div className="text-[10px] text-neutral">
                    {new Date(r.work_date).toLocaleDateString("vi-VN", { weekday: "short" })}
                  </div>
                  <div className="text-[15px] font-extrabold leading-none text-brand">
                    {new Date(r.work_date).getDate()}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12.5px] text-ink">
                    {hm(r.check_in_at)} →{" "}
                    {r.check_out_at ? hm(r.check_out_at) : <span className="text-tint-tx-danger">Thiếu</span>}
                  </div>
                  <div className="text-[11px] text-neutral">{r.work_type?.code ?? "—"}</div>
                </div>
                <div className="flex-none text-right">
                  <StatusBadge
                    tone={r.state === "missing_checkout" ? "danger" : r.checkin_status === "Trễ" ? "warning" : "success"}
                    dot={false}
                    className="px-2 py-0.5 text-[11px]"
                  >
                    {r.state === "missing_checkout" ? "Quên ra" : r.checkin_status}
                  </StatusBadge>
                  <div className="mt-0.5 font-mono text-[11.5px] text-ink">
                    {r.state === "complete" ? r.computed_workday : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-divider pt-3 text-[12px]">
          <span className="text-neutral">
            Tổng công: <b className="text-brand">{ngayCong}</b> · {rows.length} lượt
          </span>
          <Link href={`/cham-cong/lich-su?month=${month}`} className="font-semibold text-primary">
            Xem chi tiết →
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="text-center">
      <div className={`text-[18px] font-extrabold ${tone}`}>{value}</div>
      <div className="text-[11px] text-neutral">{label}</div>
    </div>
  );
}

function hm(s: string) {
  return new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
