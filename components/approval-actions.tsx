"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ApprovalActions({
  flowId,
  finalLabel = "Duyệt cấp cuối",
  compact = false,
}: {
  flowId: string;
  finalLabel?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "Duyệt" | "Từ chối") {
    if (decision === "Từ chối" && !reason.trim()) {
      setError("Nhập lý do từ chối.");
      return;
    }
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("decide_request", {
        p_flow: flowId,
        p_decision: decision,
        p_reason: reason || null,
      });
      if (error) return setError(error.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      {!compact && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Ghi chú / lý do (nếu từ chối)…"
          className="w-full rounded-input border border-input bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
      )}
      {error && <div className="text-[12px] text-tint-tx-danger">⚠ {error}</div>}
      <div className="flex gap-2.5">
        <Button type="button" variant="danger" disabled={pending} onClick={() => decide("Từ chối")} className="flex-1">
          Từ chối
        </Button>
        <Button type="button" disabled={pending} onClick={() => decide("Duyệt")} className="flex-[1.6]">
          {pending ? "Đang xử lý…" : finalLabel}
        </Button>
      </div>
    </div>
  );
}
