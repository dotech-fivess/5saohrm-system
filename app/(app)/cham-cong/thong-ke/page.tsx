import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/date-range";
import { getCatalogs } from "@/lib/queries";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatsBarChart } from "@/components/stats-bar-chart";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ExportButton } from "@/components/export-button";
import { PageHeader } from "@/components/page-header";

type Row = {
  name: string;
  hc: number;
  tc: number;
  on: number;
  late: number;
  forgot: number;
};

export default async function Page({
  searchParams,
}: {
  searchParams: { month?: string; from?: string; to?: string; department?: string };
}) {
  const supabase = createClient();
  const { from, toExclusive, label } = resolveRange(searchParams);
  const catalogs = await getCatalogs();
  const dept = searchParams.department || "";

  const { data } = await supabase
    .from("attendance_records")
    .select("checkin_status, state, computed_workday, employee:profiles(full_name, department_id), work_type:work_types(code)")
    .gte("work_date", from)
    .lt("work_date", toExclusive);

  let att = (data ?? []) as any[];
  if (dept) att = att.filter((a) => a.employee?.department_id === dept);

  const qs = new URLSearchParams(searchParams as Record<string, string>).toString();

  const byType: Record<string, number> = { HC: 0, TC120: 0, TC150: 0, ON: 0 };
  let late = 0;
  let forgot = 0;
  const perEmp = new Map<string, Row>();

  for (const r of att) {
    const code = r.work_type?.code as string | undefined;
    const wd = Number(r.computed_workday || 0);
    if (code && code in byType) byType[code] += wd;
    const isLate = r.checkin_status === "Trễ";
    const isForgot = r.state === "missing_checkout";
    if (isLate) late++;
    if (isForgot) forgot++;

    const name = r.employee?.full_name ?? "—";
    const e = perEmp.get(name) ?? { name, hc: 0, tc: 0, on: 0, late: 0, forgot: 0 };
    if (code === "HC") e.hc += wd;
    else if (code === "TC120" || code === "TC150") e.tc += wd;
    else if (code === "ON") e.on += wd;
    if (isLate) e.late++;
    if (isForgot) e.forgot++;
    perEmp.set(name, e);
  }

  const rows = [...perEmp.values()]
    .map((r) => ({ ...r, total: round(r.hc + r.tc + r.on) }))
    .sort((a, b) => b.total - a.total);
  const totals = rows.reduce(
    (a, r) => ({
      hc: a.hc + r.hc,
      tc: a.tc + r.tc,
      on: a.on + r.on,
      total: a.total + r.total,
      late: a.late + r.late,
      forgot: a.forgot + r.forgot,
    }),
    { hc: 0, tc: 0, on: 0, total: 0, late: 0, forgot: 0 }
  );
  const chart = [
    { name: "HC", value: round(byType.HC) },
    { name: "TC120", value: round(byType.TC120) },
    { name: "TC150", value: round(byType.TC150) },
    { name: "ON", value: round(byType.ON) },
  ];
  const kpis = [
    { label: "Tổng lượt chấm", value: att.length },
    { label: "Đi trễ", value: late, tone: "text-tint-tx-warn" },
    { label: "Chưa check-out", value: forgot, tone: "text-tint-tx-danger" },
    { label: "Công HC", value: round(byType.HC), tone: "text-brand" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: "Chấm công", href: "/cham-cong" }, { label: "Thống kê" }]}
        title={`Thống kê công · ${label}`}
        action={
          <>
            <DateRangeFilter
              action="/cham-cong/thong-ke"
              month={searchParams.month}
              from={searchParams.from}
              to={searchParams.to}
              departments={catalogs.departments}
              department={dept}
            />
            <ExportButton href={`/api/export?type=attendance-stats&${qs}`} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardBody className="p-4">
              <div className="text-[12px] text-neutral">{k.label}</div>
              <div className={"mt-1 text-[24px] font-black " + (k.tone ?? "text-brand")}>{k.value}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Bảng thống kê theo nhân viên */}
        <Card className="overflow-hidden">
          <CardBody className="border-b pb-3"><CardTitle>Thống kê theo nhân viên</CardTitle></CardBody>
          <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.9fr_0.65fr_0.7fr] gap-2 bg-app px-4 py-2.5 text-[11px] font-bold uppercase text-neutral">
            <span>Nhân viên</span><span className="text-right">HC</span><span className="text-right">TC</span><span className="text-right">ON</span><span className="text-right text-brand">Tổng</span><span className="text-right">Trễ</span><span className="text-right">Quên</span>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted">Không có dữ liệu trong khoảng đã chọn.</div>
          ) : (
            <>
              {rows.map((r) => (
                <div key={r.name} className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.9fr_0.65fr_0.7fr] gap-2 border-b border-divider px-4 py-2.5 text-[13px]">
                  <span className="text-ink">{r.name}</span>
                  <span className="text-right font-mono">{round(r.hc)}</span>
                  <span className="text-right font-mono">{round(r.tc)}</span>
                  <span className="text-right font-mono">{round(r.on)}</span>
                  <span className="text-right font-mono font-bold text-brand">{r.total}</span>
                  <span className={"text-right font-mono " + (r.late ? "text-tint-tx-warn" : "text-muted")}>{r.late}</span>
                  <span className={"text-right font-mono " + (r.forgot ? "text-tint-tx-danger" : "text-muted")}>{r.forgot}</span>
                </div>
              ))}
              <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.9fr_0.65fr_0.7fr] gap-2 bg-app px-4 py-2.5 text-[13px] font-bold">
                <span className="text-ink">Tổng cộng ({rows.length})</span>
                <span className="text-right font-mono">{round(totals.hc)}</span>
                <span className="text-right font-mono">{round(totals.tc)}</span>
                <span className="text-right font-mono">{round(totals.on)}</span>
                <span className="text-right font-mono text-brand">{round(totals.total)}</span>
                <span className="text-right font-mono text-tint-tx-warn">{totals.late}</span>
                <span className="text-right font-mono text-tint-tx-danger">{totals.forgot}</span>
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardBody>
            <CardTitle className="mb-3">Ngày công theo loại</CardTitle>
            <StatsBarChart data={chart} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
