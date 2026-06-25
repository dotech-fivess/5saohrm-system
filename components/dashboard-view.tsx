import { cn } from "@/lib/utils";

type Bar = { name: string; value: number };

export type DashboardData = {
  month: string;
  m: number;
  y: number;
  dept: string;
  deptName: string;
  departments: { id: string; name: string }[];
  totalStaff: number;
  byContract: { "Chính thức": number; "Thử việc": number; TTS: number };
  otherContract: number;
  byDept: Bar[];
  byLoc: Bar[];
  lateTop: Bar[];
  forgotTop: Bar[];
  otTop: Bar[];
  byLeaveType: Bar[];
  leaveTop: Bar[];
};

export function DashboardView(d: DashboardData) {
  return (
    <div className="space-y-4">
      {/* Header — kỳ số liệu (trái) + bộ lọc (phải) trên cùng một hàng */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-neutral">
          Số liệu tháng <b className="text-brand">{d.m}/{d.y}</b> ·{" "}
          <b className="text-brand">{d.deptName || "Tất cả phòng ban"}</b>
        </div>
        <form action="/dashboard" className="flex flex-wrap gap-2">
          <input
            type="month"
            name="month"
            defaultValue={d.month}
            className="rounded-[8px] border border-input bg-surface px-3 py-1.5 text-[12.5px]"
          />
          <select
            name="department"
            defaultValue={d.dept}
            className="rounded-[8px] border border-input bg-surface px-3 py-1.5 text-[12.5px]"
          >
            <option value="">Tất cả phòng ban</option>
            {d.departments.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
          <button className="rounded-[8px] bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-white">
            Lọc
          </button>
        </form>
      </div>

      {/* KPI strip — dùng hết chiều ngang, thay cho card "Tổng nhân sự" bị giãn */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi big v={d.totalStaff} l="Tổng nhân sự" tone="brand" />
        <Kpi v={d.byContract["Chính thức"]} l="Chính thức" tone="success" />
        <Kpi v={d.byContract["Thử việc"]} l="Thử việc" tone="warn" />
        <Kpi v={d.byContract.TTS} l="TTS" tone="blue" />
        <Kpi v={d.otherContract} l="Khác" tone="neutral" />
      </div>

      {/* Phân bố nhân sự */}
      <Section label="Phân bố nhân sự">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel title="Theo phòng ban">
            <BarList data={d.byDept} color="#2C68C9" />
          </Panel>
          <Panel title="Theo địa điểm">
            <BarList data={d.byLoc} color="#16345E" />
          </Panel>
        </div>
      </Section>

      {/* Chấm công */}
      <Section label={`Chấm công · tháng ${d.m}/${d.y}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Panel title="🔻 Đi trễ nhiều nhất">
            <RankList data={d.lateTop} unit="lần" tone="text-tint-tx-warn" />
          </Panel>
          <Panel title="⏱ Quên chấm nhiều nhất">
            <RankList data={d.forgotTop} unit="lần" tone="text-tint-tx-danger" />
          </Panel>
          <Panel title="⚡ Tăng ca nhiều nhất">
            <RankList data={d.otTop} unit="lần" tone="text-tint-tx-blue" />
          </Panel>
        </div>
      </Section>

      {/* Nghỉ phép */}
      <Section label={`Nghỉ phép · tháng ${d.m}/${d.y}`}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel title="Cơ cấu loại nghỉ">
            <BarList data={d.byLeaveType} color="#2C68C9" />
          </Panel>
          <Panel title="🏖 Xin nghỉ nhiều nhất">
            <RankList data={d.leaveTop} unit="đơn" tone="text-brand" />
          </Panel>
        </div>
      </Section>
    </div>
  );
}

// ---------- UI bits ----------
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="text-[11.5px] font-extrabold uppercase tracking-wide text-muted">{label}</div>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border bg-surface p-4 shadow-card">
      <div className="mb-2.5 text-[12.5px] font-bold text-brand">{title}</div>
      {children}
    </div>
  );
}

const KPI_TONE: Record<string, string> = {
  brand: "text-brand",
  success: "text-tint-tx-success",
  warn: "text-tint-tx-warn",
  blue: "text-tint-tx-blue",
  neutral: "text-neutral",
};
function Kpi({ v, l, tone, big }: { v: number; l: string; tone: string; big?: boolean }) {
  return (
    <div className="rounded-card border bg-surface px-4 py-2.5 shadow-card">
      <div className={cn("font-black leading-tight", big ? "text-[26px]" : "text-[22px]", KPI_TONE[tone])}>{v}</div>
      <div className="text-[11.5px] text-neutral">{l}</div>
    </div>
  );
}

function BarList({ data, color }: { data: Bar[]; color: string }) {
  const max = Math.max(1, ...data.map((x) => x.value));
  if (data.length === 0) return <Empty />;
  return (
    <div className="space-y-2">
      {data.map((b) => (
        <div key={b.name} className="flex items-center gap-2">
          <span className="w-[78px] shrink-0 truncate text-[11.5px] text-ink">{b.name}</span>
          <div className="h-[7px] flex-1 rounded-[4px] bg-divider">
            <div className="h-full rounded-[4px]" style={{ width: `${(b.value / max) * 100}%`, background: color }} />
          </div>
          <span className="w-6 shrink-0 text-right text-[11px] text-neutral">{b.value}</span>
        </div>
      ))}
    </div>
  );
}

function RankList({ data, unit, tone }: { data: Bar[]; unit: string; tone: string }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="space-y-1">
      {data.map((r, i) => (
        <div key={r.name} className="flex justify-between border-b border-divider py-1 last:border-0">
          <span className="truncate text-[12.5px] text-ink">{i + 1}. {r.name}</span>
          <span className={cn("shrink-0 pl-2 text-[12.5px] font-bold", tone)}>{r.value} {unit}</span>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="py-1 text-[12.5px] text-muted">Chưa có dữ liệu.</div>;
}
