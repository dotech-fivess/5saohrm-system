import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { getCatalogs, getEmployees } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/export-button";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  "Đang làm": "success",
  "Thử việc": "warning",
  "Tạm nghỉ": "neutral",
  "Nghỉ việc": "neutral",
};

export default async function Page({
  searchParams,
}: {
  searchParams: { q?: string; department?: string; status?: string };
}) {
  const [{ rows }, catalogs] = await Promise.all([
    getEmployees(searchParams),
    getCatalogs(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex flex-wrap gap-2">
          <ExportButton href="/api/export?type=employees" />
          <Link href="/nhan-su/moi">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Thêm nhân viên
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <form className="flex flex-wrap gap-2.5" action="/nhan-su">
        <div className="flex flex-1 items-center gap-2 rounded-input border border-input bg-surface px-3.5 py-2.5">
          <Search className="h-4 w-4 text-muted" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Tìm theo tên, mã NV, email…"
            className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <select
          name="department"
          defaultValue={searchParams.department ?? ""}
          className="rounded-input border border-input bg-surface px-3.5 py-2.5 text-[13.5px] text-ink"
        >
          <option value="">Phòng ban</option>
          {catalogs.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="rounded-input border border-input bg-surface px-3.5 py-2.5 text-[13.5px] text-ink"
        >
          <option value="">Trạng thái</option>
          {["Đang làm", "Thử việc", "Tạm nghỉ", "Nghỉ việc"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Lọc
        </Button>
      </form>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[2.2fr_1fr_1.2fr_1fr_0.4fr] gap-3 border-b bg-app px-[18px] py-3 text-[12px] font-bold uppercase tracking-wide text-neutral">
          <span>Nhân viên</span>
          <span>Mã NV</span>
          <span>Phòng ban</span>
          <span>Trạng thái</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/nhan-su/${r.id}`}
              className="grid grid-cols-[2.2fr_1fr_1.2fr_1fr_0.4fr] items-center gap-3 border-b border-divider px-[18px] py-3 hover:bg-app"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint-blue text-[12px] font-bold text-tint-tx-blue">
                  {initials(r.full_name)}
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">
                    {r.full_name || "(chưa đặt tên)"}
                  </div>
                  <div className="text-[12px] text-neutral">
                    {r.position?.name ?? "—"}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[12.5px] text-neutral">
                {r.employee_code}
              </span>
              <span className="text-[13px] text-ink">
                {r.department?.name ?? "—"}
              </span>
              <span>
                <StatusBadge tone={STATUS_TONE[r.work_status] ?? "neutral"} dot={false}>
                  {r.work_status}
                </StatusBadge>
              </span>
              <span className="text-right text-muted">›</span>
            </Link>
          ))
        )}
      </Card>

      <div className="text-[13px] text-neutral">
        Hiển thị {rows.length} nhân viên
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-app">
        <Users className="h-7 w-7 text-muted" />
      </div>
      <div className="text-[15px] font-bold text-brand">Chưa có nhân viên nào</div>
      <div className="mt-1.5 text-[13px] text-neutral">
        Không tìm thấy nhân viên khớp bộ lọc. Thử xoá lọc hoặc thêm nhân viên mới.
      </div>
    </div>
  );
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "NV"
  );
}
