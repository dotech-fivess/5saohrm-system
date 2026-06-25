import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/date-range";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ExportButton } from "@/components/export-button";
import { PageHeader } from "@/components/page-header";
import { Lock } from "lucide-react";

export default async function Page({
  searchParams,
}: {
  searchParams: { month?: string; from?: string; to?: string };
}) {
  const supabase = createClient();
  const { from, toExclusive, label } = resolveRange(searchParams);
  const qs = new URLSearchParams(searchParams as Record<string, string>).toString();

  const { data } = await supabase
    .from("attendance_records")
    .select("id, work_date, check_in_at, check_out_at, checkin_status, state, computed_workday, work_type:work_types(code)")
    .gte("work_date", from)
    .lt("work_date", toExclusive)
    .order("work_date", { ascending: false });

  const rows = (data ?? []) as any[];
  const total = rows.reduce((s, r) => s + Number(r.computed_workday || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: "Chấm công", href: "/cham-cong" }, { label: "Lịch sử công" }]}
        title={`Lịch sử công · ${label}`}
        action={
          <>
            <DateRangeFilter action="/cham-cong/lich-su" month={searchParams.month} from={searchParams.from} to={searchParams.to} />
            <ExportButton href={`/api/export?type=attendance&${qs}`} />
          </>
        }
      />

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-muted">Không có dữ liệu chấm công trong khoảng đã chọn.</Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <Card key={r.id} className="flex items-center gap-3 p-3.5">
              <div className="text-center">
                <div className="text-[11px] text-neutral">
                  {new Date(r.work_date).toLocaleDateString("vi-VN", { weekday: "short" })}
                </div>
                <div className="text-[15px] font-extrabold text-brand">{new Date(r.work_date).getDate()}</div>
                <div className="text-[10px] text-muted">
                  {new Date(r.work_date).toLocaleDateString("vi-VN", { month: "2-digit" })}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-mono text-[13px] text-ink">
                  {hm(r.check_in_at)} → {r.check_out_at ? hm(r.check_out_at) : <span className="text-tint-tx-danger">Thiếu</span>}
                </div>
                <div className="text-[11.5px] text-neutral">{r.work_type?.code ?? "—"}</div>
              </div>
              <div className="text-right">
                <StatusBadge
                  tone={r.state === "missing_checkout" ? "danger" : r.checkin_status === "Trễ" ? "warning" : "success"}
                  dot={false}
                >
                  {r.state === "missing_checkout" ? "Quên ra" : r.checkin_status}
                </StatusBadge>
                <div className="mt-1 font-mono text-[12px] text-ink">
                  {r.state === "complete" ? r.computed_workday : "—"}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-[12.5px] text-neutral">
        <Lock className="h-3.5 w-3.5" /> Lịch sử bất biến, chỉ xem
        <span className="ml-auto">
          Tổng công: <b className="text-brand">{round(total)}</b> · {rows.length} lượt
        </span>
      </div>
    </div>
  );
}

function hm(s: string) {
  return new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
