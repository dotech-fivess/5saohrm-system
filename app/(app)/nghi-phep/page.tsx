import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminArea, type Profile } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/export-button";
import { Plus, Inbox } from "lucide-react";

const TONE: Record<string, "success" | "warning" | "danger"> = {
  "Duyệt": "success",
  "Chờ": "warning",
  "Không duyệt": "danger",
};

const TABS = [
  { key: "", label: "Tất cả" },
  { key: "Chờ", label: "Chờ" },
  { key: "Duyệt", label: "Đã duyệt" },
  { key: "Không duyệt", label: "Không duyệt" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role, title:titles(name)").eq("id", user!.id).single();
  const role = (me as Profile | null)?.role ?? "nhan_vien";
  const isHead = (me as any)?.title?.name === "Trưởng phòng";
  const admin = isAdminArea(role);
  const isManager = role === "quan_ly";
  // Nút vào hàng duyệt: quản lý → hàng chờ tổng hợp; trưởng phòng → đơn phòng mình
  const approveHref = isManager ? "/nghi-phep/cho-duyet" : isHead ? "/nghi-phep/duyet-phong" : null;
  const approveLabel = isManager ? "Hàng chờ duyệt" : "Duyệt đơn phòng";
  const status = searchParams.status ?? "";

  let q = supabase
    .from("leave_requests")
    .select("id, start_date, end_date, hours, status, reason, leave_type:leave_types(name), employee:profiles(full_name, employee_code)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  // Nhân viên (kể cả trưởng phòng) chỉ xem ĐƠN CỦA MÌNH ở đây; đơn của phòng xem ở /duyet-phong
  if (!admin) q = q.eq("employee_id", user!.id);
  const rows = ((await q).data ?? []) as any[];

  // đếm chờ duyệt: admin = toàn bộ; trưởng phòng = đơn phòng mình (trừ đơn của chính mình)
  let pending = 0;
  if (admin || isManager) {
    const { count } = await supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "Chờ");
    pending = count ?? 0;
  } else if (isHead) {
    const { count } = await supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "Chờ")
      .neq("employee_id", user!.id);
    pending = count ?? 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-extrabold text-brand">
          {admin ? "Tất cả đơn" : "Đơn của tôi"}
        </h1>
        {admin ? (
          <div className="flex flex-wrap gap-2">
            <ExportButton href={`/api/export?type=leave${status ? `&status=${encodeURIComponent(status)}` : ""}`} />
            <Link href="/nghi-phep/cho-duyet">
              <Button size="sm" variant="secondary">
                <Inbox className="h-4 w-4" /> Hàng chờ duyệt{pending ? ` (${pending})` : ""}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {approveHref && (
              <Link href={approveHref}>
                <Button size="sm" variant="secondary">
                  <Inbox className="h-4 w-4" /> {approveLabel}{pending ? ` (${pending})` : ""}
                </Button>
              </Link>
            )}
            <Link href="/nghi-phep/dang-ky">
              <Button size="sm">
                <Plus className="h-4 w-4" /> Tạo đơn
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Tabs trạng thái */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/nghi-phep?status=${encodeURIComponent(t.key)}` : "/nghi-phep"}
            className={
              "rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold " +
              (status === t.key
                ? "bg-primary text-white"
                : "border bg-surface text-neutral")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-muted">
          Không có đơn nào{status ? ` ở trạng thái "${status}"` : ""}.
        </Card>
      ) : admin ? (
        // Bảng cho admin/quản lý
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1.2fr_1.2fr_0.8fr_1fr] gap-2 border-b bg-app px-4 py-3 text-[11.5px] font-bold uppercase text-neutral">
            <span>Nhân viên</span><span>Loại</span><span>Thời gian</span><span>Số giờ</span><span>Trạng thái</span>
          </div>
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/nghi-phep/${r.id}`}
              className="grid grid-cols-[1.6fr_1.2fr_1.2fr_0.8fr_1fr] items-center gap-2 border-b border-divider px-4 py-3 text-[13px] hover:bg-app"
            >
              <span className="font-medium text-ink">{r.employee?.full_name ?? "—"}</span>
              <span className="text-ink">{r.leave_type?.name ?? "—"}</span>
              <span className="text-neutral">{fmt(r.start_date)}{r.end_date && r.end_date !== r.start_date ? `→${fmt(r.end_date)}` : ""}</span>
              <span className="font-mono text-neutral">{r.hours ? r.hours + "h" : "—"}</span>
              <span><StatusBadge tone={TONE[r.status] ?? "warning"} dot={false}>{r.status}</StatusBadge></span>
            </Link>
          ))}
        </Card>
      ) : (
        // Card cho nhân viên
        <div className="space-y-2.5">
          {rows.map((r) => (
            <Link key={r.id} href={`/nghi-phep/${r.id}`}>
              <Card className="p-3.5 hover:bg-app">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[13.5px] font-bold text-brand">{r.leave_type?.name ?? "Nghỉ phép"}</div>
                    <div className="text-[12px] text-neutral">
                      {fmt(r.start_date)}{r.end_date && r.end_date !== r.start_date ? ` → ${fmt(r.end_date)}` : ""}
                      {r.hours ? ` · ${r.hours}h` : ""}
                    </div>
                  </div>
                  <StatusBadge tone={TONE[r.status] ?? "warning"} dot={false}>{r.status}</StatusBadge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
