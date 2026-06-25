import { createClient } from "@/lib/supabase/server";
import { getCatalogs } from "@/lib/queries";
import { Card, CardBody } from "@/components/ui/card";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string; department?: string };
}) {
  const supabase = createClient();
  const catalogs = await getCatalogs();

  const now = new Date();
  const month = searchParams.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const dept = searchParams.department || "";

  // ---- Nhân sự ----
  let pq = supabase.from("profiles").select("id, contract_type, department:departments(name)");
  if (dept) pq = pq.eq("department_id", dept);
  const profiles = ((await pq).data ?? []) as any[];

  const totalStaff = profiles.length;
  const byContract = {
    "Chính thức": profiles.filter((p) => p.contract_type === "Chính thức").length,
    "Thử việc": profiles.filter((p) => p.contract_type === "Thử việc").length,
    TTS: profiles.filter((p) => p.contract_type === "TTS").length,
  };
  // Hồ sơ chưa gán loại HĐ → gộp vào "Khác" để breakdown luôn khớp tổng
  const otherContract = totalStaff - byContract["Chính thức"] - byContract["Thử việc"] - byContract.TTS;
  // Bucket null thành "Chưa phân loại" để tổng theo phòng ban/địa điểm khớp tổng nhân sự
  const byDept = topCounts(profiles.map((p) => p.department?.name ?? "Chưa phân loại"));
  const empLocs = ((await supabase.from("employee_locations").select("location:locations(name)")).data ?? []) as any[];
  const byLoc = topCounts(empLocs.map((e) => e.location?.name ?? "Chưa phân loại"));

  // ---- Chấm công (tháng) ----
  let att = ((
    await supabase
      .from("attendance_records")
      .select("checkin_status, state, computed_workday, employee:profiles(full_name, department_id), work_type:work_types(code)")
      .gte("work_date", from)
      .lt("work_date", to)
  ).data ?? []) as any[];
  if (dept) att = att.filter((a) => a.employee?.department_id === dept);

  const lateTop = topByEmployee(att.filter((a) => a.checkin_status === "Trễ"), (a) => a.employee?.full_name);
  const forgotTop = topByEmployee(att.filter((a) => a.state === "missing_checkout"), (a) => a.employee?.full_name);
  const otTop = topByEmployee(att.filter((a) => ["TC120", "TC150"].includes(a.work_type?.code)), (a) => a.employee?.full_name);

  // ---- Nghỉ phép (tháng) ----
  let leaves = ((
    await supabase
      .from("leave_requests")
      .select("status, leave_type:leave_types(name), employee:profiles(full_name, department_id)")
      .gte("start_date", from)
      .lt("start_date", to)
  ).data ?? []) as any[];
  if (dept) leaves = leaves.filter((l) => l.employee?.department_id === dept);

  const byLeaveType = topCounts(leaves.map((l) => l.leave_type?.name).filter(Boolean), 6);
  const leaveTop = topByEmployee(leaves, (l) => l.employee?.full_name);

  return (
    <div className="space-y-6">
      {/* Filter bar (S20) */}
      <form action="/dashboard" className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          <input type="month" name="month" defaultValue={month} className="rounded-[8px] border border-input bg-surface px-3 py-2 text-[12.5px]" />
          <select name="department" defaultValue={dept} className="rounded-[8px] border border-input bg-surface px-3 py-2 text-[12.5px]">
            <option value="">Tất cả phòng ban</option>
            {catalogs.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button className="rounded-[8px] bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white">Lọc</button>
        </div>
      </form>

      {/* GROUP 1 — Nhân sự */}
      <Group n="01" title="Tổng quan nhân sự" tone="blue">
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <Card>
            <CardBody className="flex items-center gap-4">
              <div>
                <div className="text-[12px] text-neutral">Tổng nhân sự</div>
                <div className="text-[30px] font-black text-brand">{totalStaff}</div>
              </div>
              <div className="flex flex-1 gap-2">
                <MiniStat tone="success" v={byContract["Chính thức"]} l="Chính thức" />
                <MiniStat tone="warn" v={byContract["Thử việc"]} l="Thử việc" />
                <MiniStat tone="blue" v={byContract.TTS} l="TTS" />
                {otherContract > 0 && <MiniStat tone="neutral" v={otherContract} l="Khác" />}
              </div>
            </CardBody>
          </Card>
          <Card><CardBody><BarList title="Theo phòng ban" data={byDept} color="#2C68C9" /></CardBody></Card>
          <Card><CardBody><BarList title="Theo địa điểm" data={byLoc} color="#16345E" /></CardBody></Card>
        </div>
      </Group>

      {/* GROUP 2 — Chấm công */}
      <Group n="02" title="Tổng quan chấm công" tone="warn" sub={`tháng ${m}/${y}`}>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <Card><CardBody><RankList title="🔻 Đi trễ nhiều nhất" data={lateTop} unit="lần" tone="text-tint-tx-warn" /></CardBody></Card>
          <Card><CardBody><RankList title="⏱ Quên chấm nhiều nhất" data={forgotTop} unit="lần" tone="text-tint-tx-danger" /></CardBody></Card>
          <Card><CardBody><RankList title="⚡ Tăng ca nhiều nhất" data={otTop} unit="lần" tone="text-tint-tx-blue" /></CardBody></Card>
        </div>
      </Group>

      {/* GROUP 3 — Nghỉ phép */}
      <Group n="03" title="Tổng quan nghỉ phép" tone="blue">
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Card><CardBody><BarList title="Cơ cấu loại nghỉ trong tháng" data={byLeaveType} color="#2C68C9" /></CardBody></Card>
          <Card><CardBody><RankList title="🏖 Xin nghỉ nhiều nhất" data={leaveTop} unit="đơn" tone="text-brand" /></CardBody></Card>
        </div>
      </Group>
    </div>
  );
}

// ---------- helpers ----------
function topCounts(items: string[], limit = 5): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}
function topByEmployee(rows: any[], pick: (r: any) => string | undefined, limit = 3) {
  return topCounts(rows.map(pick).filter(Boolean) as string[], limit);
}

function Group({ n, title, tone, sub, children }: { n: string; title: string; tone: "blue" | "warn"; sub?: string; children: React.ReactNode }) {
  const c = tone === "warn" ? "bg-tint-warn text-tint-tx-warn" : "bg-tint-blue text-tint-tx-blue";
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={"rounded-md px-2 py-1 text-[12px] font-extrabold " + c}>{n}</span>
        <span className="text-[14px] font-extrabold text-brand">{title}</span>
        {sub && <span className="text-[12px] text-muted">· {sub}</span>}
      </div>
      {children}
    </section>
  );
}
function MiniStat({ tone, v, l }: { tone: "success" | "warn" | "blue" | "neutral"; v: number; l: string }) {
  const map: Record<string, string> = { success: "bg-tint-success text-tint-tx-success", warn: "bg-tint-warn text-tint-tx-warn", blue: "bg-tint-blue text-tint-tx-blue", neutral: "bg-[#F0F3F1] text-neutral" };
  return (
    <div className={"flex-1 rounded-[9px] p-2 text-center " + map[tone]}>
      <div className="text-[17px] font-extrabold">{v}</div>
      <div className="text-[10.5px]">{l}</div>
    </div>
  );
}
function BarList({ title, data, color }: { title: string; data: { name: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="mb-2.5 text-[12px] text-neutral">{title}</div>
      {data.length === 0 ? (
        <div className="text-[12.5px] text-muted">Chưa có dữ liệu.</div>
      ) : (
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-[72px] truncate text-[11.5px] text-ink">{d.name}</span>
              <div className="h-[7px] flex-1 rounded-[4px] bg-divider">
                <div className="h-full rounded-[4px]" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
              </div>
              <span className="text-[11px] text-neutral">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function RankList({ title, data, unit, tone }: { title: string; data: { name: string; value: number }[]; unit: string; tone: string }) {
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-bold text-brand">{title}</div>
      {data.length === 0 ? (
        <div className="text-[12.5px] text-muted">Chưa có dữ liệu.</div>
      ) : (
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={d.name} className="flex justify-between border-b border-divider py-1 last:border-0">
              <span className="text-[12.5px] text-ink">{i + 1}. {d.name}</span>
              <span className={"text-[12.5px] font-bold " + tone}>{d.value} {unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
