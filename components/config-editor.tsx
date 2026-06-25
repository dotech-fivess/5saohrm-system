"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkType, updateConfigParameter } from "@/app/(app)/cau-hinh/actions";

const PARAM_LABEL: Record<string, string> = {
  hc_full_threshold_min: "Ngưỡng đủ ngày HC (phút, ≥5h=300)",
  hc_half_threshold_min: "Ngưỡng nửa ngày HC (phút, ≥1h=60)",
  late_early_max_min: "Tối đa đi trễ/về sớm (phút, 3h=180)",
  coef_tc120: "Hệ số tăng ca 120",
  coef_tc150: "Hệ số tăng ca 150",
  coef_online: "Hệ số online (HC×½=0.5)",
  standard_workday: "Ngày công chuẩn (giờ)",
};

type WorkType = { id: string; code: string; name: string; coefficient: number };
type Param = { key: string; value: any; description: string | null };

export function ConfigEditor({ workTypes, params }: { workTypes: WorkType[]; params: Param[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ k: string; text: string; ok: boolean } | null>(null);

  function save(fn: () => Promise<{ error?: string } | void>, key: string) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setMsg({ k: key, text: res.error, ok: false });
      else {
        setMsg({ k: key, text: "Đã lưu", ok: true });
        router.refresh();
      }
    });
  }

  // chỉ tham số kiểu số (bỏ qua rounding... dạng chuỗi)
  const numParams = params.filter((p) => typeof p.value === "number" || !isNaN(Number(p.value)));

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[13px] font-bold text-brand">Loại công &amp; hệ số ngày công</div>
        <div className="space-y-2">
          {workTypes.map((w) => (
            <WtRow key={w.id} w={w} pending={pending} msg={msg?.k === "wt-" + w.id ? msg : null}
              onSave={(fd) => save(() => updateWorkType(w.id, fd), "wt-" + w.id)} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[13px] font-bold text-brand">Tham số tính công</div>
        <div className="mb-2 rounded-[9px] border border-tint-bd-warn bg-tint-warn px-3 py-2 text-[12px] text-tint-tx-warn">
          ⚙ Ngưỡng &amp; hệ số là tham số cấu hình được (không hard-code). Sửa ở đây ảnh hưởng toàn hệ thống tính công.
        </div>
        <div className="space-y-2">
          {numParams.map((p) => (
            <ParamRow key={p.key} p={p} pending={pending} msg={msg?.k === "cf-" + p.key ? msg : null}
              onSave={(fd) => save(() => updateConfigParameter(p.key, fd), "cf-" + p.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WtRow({ w, onSave, pending, msg }: { w: WorkType; onSave: (fd: FormData) => void; pending: boolean; msg: { text: string; ok: boolean } | null }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} onSubmit={(e) => { e.preventDefault(); onSave(new FormData(ref.current!)); }} className="flex flex-wrap items-center gap-2 rounded-[11px] border px-3.5 py-2.5">
      <span className="w-[60px] font-mono text-[12px] text-neutral">{w.code}</span>
      <input name="name" defaultValue={w.name} className="flex-1 rounded-input border border-input bg-surface px-2.5 py-1.5 text-[13px]" />
      <span className="text-[12px] text-neutral">×</span>
      <input name="coefficient" type="number" step="0.1" min="0" defaultValue={w.coefficient} className="w-[80px] rounded-input border border-input bg-surface px-2.5 py-1.5 text-center font-mono text-[13px]" />
      <button type="submit" disabled={pending} className="rounded-btn border border-input px-3 py-1.5 text-[12.5px] font-semibold text-brand">Lưu</button>
      {msg && <span className={"text-[12px] " + (msg.ok ? "text-tint-tx-success" : "text-tint-tx-danger")}>{msg.text}</span>}
    </form>
  );
}

function ParamRow({ p, onSave, pending, msg }: { p: Param; onSave: (fd: FormData) => void; pending: boolean; msg: { text: string; ok: boolean } | null }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} onSubmit={(e) => { e.preventDefault(); onSave(new FormData(ref.current!)); }} className="flex flex-wrap items-center gap-2 rounded-[11px] border px-3.5 py-2.5">
      <div className="flex-1">
        <div className="text-[13px] text-ink">{PARAM_LABEL[p.key] ?? p.description ?? p.key}</div>
        <div className="font-mono text-[11px] text-muted">{p.key}</div>
      </div>
      <input name="value" type="number" step="any" defaultValue={Number(p.value)} className="w-[100px] rounded-input border border-input bg-surface px-2.5 py-1.5 text-center font-mono text-[13px]" />
      <button type="submit" disabled={pending} className="rounded-btn border border-input px-3 py-1.5 text-[12.5px] font-semibold text-brand">Lưu</button>
      {msg && <span className={"text-[12px] " + (msg.ok ? "text-tint-tx-success" : "text-tint-tx-danger")}>{msg.text}</span>}
    </form>
  );
}
