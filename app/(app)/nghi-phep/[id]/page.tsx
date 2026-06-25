import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canApprove, type Profile } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalTimeline } from "@/components/approval-timeline";
import { ApprovalActions } from "@/components/approval-actions";
import { PageHeader } from "@/components/page-header";

const TONE: Record<string, "success" | "warning" | "danger"> = {
  "Duyệt": "success",
  "Chờ": "warning",
  "Không duyệt": "danger",
};

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const role = (me as Profile | null)?.role ?? "nhan_vien";

  const { data } = await supabase
    .from("leave_requests")
    .select("*, leave_type:leave_types(name), employee:profiles(full_name, employee_code), flow:approval_flows(id, status, current_level, approval_steps(level, approver_role, decision, reason))")
    .eq("id", params.id)
    .single();

  const req = data as any;
  if (!req) notFound();

  const steps = req.flow?.approval_steps ?? [];
  const canDecide = canApprove(role) && req.status === "Chờ" && req.flow?.id;

  return (
    <div className="mx-auto max-w-[520px] space-y-4">
      <PageHeader crumbs={[{ label: "Nghỉ phép", href: "/nghi-phep" }, { label: "Chi tiết đơn" }]} />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-tint-blue text-[14px] font-bold text-tint-tx-blue">
              {initials(req.employee?.full_name)}
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-extrabold text-brand">
                {req.employee?.full_name} · {req.leave_type?.name}
              </div>
              <div className="text-[12px] text-neutral">{req.employee?.employee_code}</div>
            </div>
            <StatusBadge tone={TONE[req.status] ?? "warning"} dot={false}>{req.status}</StatusBadge>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Thời gian" value={`${fmt(req.start_date)}${req.end_date && req.end_date !== req.start_date ? " → " + fmt(req.end_date) : ""}`} />
            <Field label="Số giờ/ngày" value={req.hours ? req.hours + "h" : "—"} />
            <div className="col-span-2">
              <Field label="Lý do" value={req.reason} />
            </div>
            {req.attachment_url && (
              <div className="col-span-2 rounded-[9px] border border-tint-bd-blue bg-tint-blue px-3 py-2.5 text-[12.5px] font-semibold text-tint-tx-blue">
                📎 {req.attachment_url.split("/").pop()}
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 text-[12px] font-bold uppercase tracking-wide text-brand">Luồng duyệt</div>
            <ApprovalTimeline steps={steps} />
          </div>

          {canDecide && <ApprovalActions flowId={req.flow.id} finalLabel="Duyệt" />}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[9px] bg-app px-3 py-2.5">
      <div className="text-[11.5px] text-neutral">{label}</div>
      <div className="text-[13px] font-medium text-ink">{value || "—"}</div>
    </div>
  );
}
function fmt(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function initials(name: string) {
  return (name || "").trim().split(/\s+/).slice(-2).map((p: string) => p[0]).join("").toUpperCase() || "NV";
}
