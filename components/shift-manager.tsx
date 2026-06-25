"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { addShift, updateShift, deleteShift } from "@/app/(app)/cau-hinh/actions";

type Shift = { id: string; name: string; start_time?: string | null; end_time?: string | null };

function hm(t?: string | null) {
  return t ? String(t).slice(0, 5) : "—";
}

export function ShiftManager({ shifts }: { shifts: Shift[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const addRef = useRef<HTMLFormElement>(null);
  const editRef = useRef<HTMLFormElement>(null);

  function run(fn: () => Promise<{ error?: string } | void>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-[12.5px] text-tint-tx-danger">⚠ {error}</div>}

      <form
        ref={addRef}
        onSubmit={(e) => { e.preventDefault(); run(() => addShift(new FormData(addRef.current!)), () => addRef.current?.reset()); }}
        className="flex flex-wrap items-end gap-2 rounded-[11px] border border-dashed border-input p-3"
      >
        <input name="name" placeholder="Tên ca *" className="flex-1 rounded-input border border-input bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary" />
        <label className="text-[11.5px] text-neutral">Từ<input name="start_time" type="time" className="ml-1 rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[11.5px] text-neutral">Đến<input name="end_time" type="time" className="ml-1 rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" /></label>
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-btn bg-primary px-3.5 py-2 text-[13px] font-semibold text-white"><Plus className="h-4 w-4" /> Thêm ca</button>
      </form>

      <div className="space-y-2">
        {shifts.map((sft) =>
          editing === sft.id ? (
            <form key={sft.id} ref={editRef} onSubmit={(e) => { e.preventDefault(); run(() => updateShift(sft.id, new FormData(editRef.current!)), () => setEditing(null)); }} className="flex flex-wrap items-end gap-2 rounded-[11px] border border-primary p-3">
              <input name="name" defaultValue={sft.name} className="flex-1 rounded-input border border-input bg-surface px-3 py-2 text-[13px]" />
              <input name="start_time" type="time" defaultValue={sft.start_time ?? ""} className="rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" />
              <input name="end_time" type="time" defaultValue={sft.end_time ?? ""} className="rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" />
              <button type="submit" disabled={pending} className="rounded-btn bg-primary px-3 py-2 text-[13px] font-semibold text-white">Lưu</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-btn border border-input px-3 py-2 text-[13px] font-semibold text-brand">Huỷ</button>
            </form>
          ) : (
            <div key={sft.id} className="flex items-center gap-3 rounded-[11px] border px-3.5 py-3">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{sft.name}</div>
                <div className="font-mono text-[12px] text-neutral">{hm(sft.start_time)}–{hm(sft.end_time)}</div>
              </div>
              <button onClick={() => setEditing(sft.id)} className="text-neutral hover:text-primary" aria-label="Sửa"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => run(() => deleteShift(sft.id))} disabled={pending} className="text-neutral hover:text-danger" aria-label="Xoá"><Trash2 className="h-4 w-4" /></button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
