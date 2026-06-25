import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalActions } from "@/components/approval-actions";
import { PageHeader } from "@/components/page-header";

// Trang dành cho TRƯỞNG PHÒNG (nhân viên có chức vụ 'Trưởng phòng') — nhận/xem/duyệt
// đơn nghỉ phép của nhân sự trong phòng mình. RLS giới hạn chỉ thấy đơn phòng mình.
export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, title:titles(name), department:departments(name)")
    .eq("id", user.id)
    .single();
  const isHead = (me as any)?.title?.name === "Trưởng phòng";
  if (!isHead) redirect("/nghi-phep");
  const deptName = (me as any)?.department?.name ?? "";

  const { data: leaves } = await supabase
    .from("leave_requests")
    .select(
      "id, start_date, end_date, hours, reason, attachment_url, approval_flow_id, leave_type:leave_types(name), employee:profiles(full_name, employee_code)"
    )
    .eq("status", "Chờ")
    .neq("employee_id", user.id)
    .order("created_at", { ascending: false });

  const items = ((leaves ?? []) as any[]).filter((r) => r.approval_flow_id);

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: "Nghỉ phép", href: "/nghi-phep" }, { label: "Duyệt đơn phòng" }]}
        title={`Duyệt đơn nghỉ phép${deptName ? " · " + deptName : ""}`}
        action={
          <StatusBadge tone="warning" dot={false}>
            {items.length} đơn chờ
          </StatusBadge>
        }
      />

      {items.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-muted">
          Không có đơn nghỉ phép nào đang chờ duyệt trong phòng.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id}>
              <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint-blue text-[12px] font-bold text-tint-tx-blue">
                    {initials(r.employee?.full_name)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-bold text-ink">
                      {r.employee?.full_name ?? "—"}{" "}
                      <span className="text-[11.5px] font-normal text-neutral">· {r.employee?.employee_code ?? ""}</span>
                    </div>
                    <div className="text-[13px] text-brand">{r.leave_type?.name ?? "Nghỉ phép"}</div>
                    <div className="mt-0.5 text-[12px] text-neutral">
                      {fmt(r.start_date)}
                      {r.end_date && r.end_date !== r.start_date ? " → " + fmt(r.end_date) : ""}
                      {r.hours ? " · " + r.hours + "h" : ""} · {r.reason}
                    </div>
                    {r.attachment_url && (
                      <div className="mt-1 text-[12px] text-tint-tx-blue">📎 có minh chứng đính kèm</div>
                    )}
                  </div>
                </div>
                <ApprovalActions flowId={r.approval_flow_id} finalLabel="Duyệt" />
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
function initials(name?: string) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "NV"
  );
}
