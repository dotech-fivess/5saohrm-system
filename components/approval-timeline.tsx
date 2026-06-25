import { Check } from "lucide-react";

type Step = { level: number; approver_role: string; decision: string };

const ROLE_SHORT: Record<string, string> = {
  quan_ly: "Quản lý",
  admin: "Quản trị",
  // tương thích dữ liệu cũ
  qt_sua: "Quản trị",
  qt_xem: "Quản trị",
};

// Render luồng: NV (luôn xong) + các bước theo loại yêu cầu
export function ApprovalTimeline({ steps }: { steps: Step[] }) {
  const sorted = [...steps].sort((a, b) => a.level - b.level);
  const nodes = [
    { label: "Nhân viên", decision: "Duyệt" as string },
    ...sorted.map((s) => ({ label: ROLE_SHORT[s.approver_role] ?? s.approver_role, decision: s.decision })),
  ];

  return (
    <div className="flex items-start">
      {nodes.map((n, i) => {
        const approved = n.decision === "Duyệt";
        const rejected = n.decision === "Từ chối";
        const waiting = n.decision === "Chờ";
        return (
          <div key={i} className="flex flex-1 items-start">
            <div className="flex-1 text-center">
              <div
                className={
                  "mx-auto flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-bold " +
                  (approved
                    ? "bg-success text-white"
                    : rejected
                    ? "bg-danger text-white"
                    : "border-2 border-warning bg-surface text-tint-tx-warn")
                }
              >
                {approved ? <Check className="h-4 w-4" /> : rejected ? "✕" : i + 1}
              </div>
              <div className="mt-1.5 text-[11.5px] font-semibold text-ink">{n.label}</div>
              <div
                className={
                  "text-[10.5px] " +
                  (approved ? "text-success" : rejected ? "text-danger" : waiting ? "text-tint-tx-warn" : "text-muted")
                }
              >
                {approved ? "Đã duyệt" : rejected ? "Từ chối" : waiting ? "Đang chờ" : "—"}
              </div>
            </div>
            {i < nodes.length - 1 && (
              <div className={"mt-[15px] h-0.5 flex-[0.6] " + (approved ? "bg-success" : "bg-[#cdd6d1]")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
