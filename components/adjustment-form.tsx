"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdjustment } from "@/app/(app)/cham-cong/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const KINDS = [
  { value: "forgot_checkin", label: "Quên check-in" },
  { value: "forgot_checkout", label: "Quên check-out" },
  { value: "wrong_record", label: "Chấm sai công" },
];

export function AdjustmentForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState("forgot_checkout");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(formRef.current!);
    fd.set("kind", kind);
    start(async () => {
      const res = await createAdjustment(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div>
        <Label>Tình huống</Label>
        <div className="space-y-2">
          {KINDS.map((k) => (
            <button
              type="button"
              key={k.value}
              onClick={() => setKind(k.value)}
              className={
                "flex w-full items-center gap-2.5 rounded-[11px] border px-3 py-3 text-left text-[13.5px] " +
                (kind === k.value ? "border-primary bg-tint-blue font-semibold text-brand" : "border-input bg-surface text-ink")
              }
            >
              <span className={"h-[18px] w-[18px] rounded-full border-[5px] " + (kind === k.value ? "border-primary" : "border-[#cdd6d1]")} />
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2.5">
        <div className="flex-[1.4]">
          <Label>Ngày</Label>
          <Input name="date" type="date" required />
        </div>
        <div className="flex-1">
          <Label>Giờ đề xuất</Label>
          <Input name="time" type="time" />
        </div>
      </div>

      <div>
        <Label>Lý do *</Label>
        <textarea
          name="reason"
          required
          rows={3}
          placeholder="Vd: Máy hết pin nên không kịp check-out…"
          className="w-full rounded-input border border-input bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
        />
      </div>

      {error && <div className="text-[13px] text-tint-tx-danger">⚠ {error}</div>}

      <Button type="submit" size="block" disabled={pending}>
        {pending ? "Đang gửi…" : "Gửi yêu cầu duyệt"}
      </Button>
      <div className="text-center text-[11px] text-muted">Luồng: Nhân viên → Quản lý → Quản trị</div>
    </form>
  );
}
