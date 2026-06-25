import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canApprove, type Role } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalActions } from "@/components/approval-actions";
import { PageHeader } from "@/components/page-header";

const KIND_LABEL: Record<string, string> = {
  forgot_checkin: "Bổ sung công · quên check-in",
  forgot_checkout: "Bổ sung công · quên check-out",
  wrong_record: "Bổ sung công · chấm sai",
};

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (!canApprove(((me as { role?: Role } | null)?.role ?? "nhan_vien") as Role)) redirect("/nghi-phep");

  const [{ data: leaves }, { data: adjs }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, hours, reason, attachment_url, approval_flow_id, leave_type:leave_types(name), employee:profiles(full_name, employee_code), flow:approval_flows(current_level)")
      .eq("status", "Chờ")
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance_adjustments")
      .select("id, kind, reason, payload, approval_flow_id, employee:profiles(full_name, employee_code), flow:approval_flows(current_level)")
      .eq("status", "Chờ")
      .order("created_at", { ascending: false }),
  ]);

  const items = [
    ...((leaves ?? []) as any[]).map((r) => ({
      key: "l" + r.id,
      flowId: r.approval_flow_id,
      who: r.employee?.full_name ?? "—",
      code: r.employee?.employee_code ?? "",
      title: r.leave_type?.name ?? "Nghỉ phép",
      detail: `${fmt(r.start_date)}${r.end_date && r.end_date !== r.start_date ? " → " + fmt(r.end_date) : ""}${r.hours ? " · " + r.hours + "h" : ""} · ${r.reason}`,
      attachment: r.attachment_url,
      levelLabel: "Cấp cuối · Quản lý",
      finalLabel: "Duyệt",
    })),
    ...((adjs ?? []) as any[]).map((r) => {
      const lv = r.flow?.current_level ?? 1;
      return {
        key: "a" + r.id,
        flowId: r.approval_flow_id,
        who: r.employee?.full_name ?? "—",
        code: r.employee?.employee_code ?? "",
        title: KIND_LABEL[r.kind] ?? "Bổ sung công",
        detail: `${r.payload?.check_out_at ? "Giờ ra: " + new Date(r.payload.check_out_at).toLocaleString("vi-VN") + " · " : ""}${r.reason}`,
        attachment: null as string | null,
        levelLabel: lv >= 2 ? "Cấp cuối · Quản trị" : "Cấp 1 · Quản lý",
        finalLabel: lv >= 2 ? "Duyệt cấp cuối" : "Duyệt cấp 1",
      };
    }),
  ].filter((x) => x.flowId);

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: "Nghỉ phép", href: "/nghi-phep" }, { label: "Hàng chờ duyệt" }]}
        title="Hàng chờ duyệt"
        action={<StatusBadge tone="warning" dot={false}>{items.length} đơn chờ</StatusBadge>}
      />

      {items.length === 0 ? (
        <Card className="p-10 text-center text-[13px] text-muted">Không có đơn nào đang chờ duyệt.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((it) => (
            <Card key={it.key}>
              <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint-blue text-[12px] font-bold text-tint-tx-blue">
                    {initials(it.who)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-bold text-ink">
                      {it.who} <span className="text-[11.5px] font-normal text-neutral">· {it.code}</span>
                    </div>
                    <div className="text-[13px] text-brand">{it.title}</div>
                    <div className="mt-0.5 text-[12px] text-neutral">{it.detail}</div>
                    {it.attachment && <div className="mt-1 text-[12px] text-tint-tx-blue">📎 có minh chứng đính kèm</div>}
                  </div>
                  <StatusBadge tone="warning" dot={false}>{it.levelLabel}</StatusBadge>
                </div>
                <ApprovalActions flowId={it.flowId} finalLabel={it.finalLabel} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
function initials(name: string) {
  return (name || "").trim().split(/\s+/).slice(-2).map((p) => p[0]).join("").toUpperCase() || "NV";
}
