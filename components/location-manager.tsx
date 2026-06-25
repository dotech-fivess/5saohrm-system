"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { addLocation, updateLocation, deleteLocation } from "@/app/(app)/cau-hinh/actions";

type Loc = {
  id: string;
  name: string;
  province?: string | null;
  address?: string | null;
  work_start?: string | null;
  work_end?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
};

function hm(t?: string | null) {
  return t ? String(t).slice(0, 5) : "—";
}

function LocFields({ d }: { d?: Loc }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input name="name" defaultValue={d?.name} placeholder="Tên địa điểm *" className="rounded-input border border-input bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary" />
        <input name="province" defaultValue={d?.province ?? ""} placeholder="Tỉnh/Thành" className="rounded-input border border-input bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>
      <input name="address" defaultValue={d?.address ?? ""} placeholder="Địa chỉ cụ thể" className="w-full rounded-input border border-input bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[11.5px] text-neutral">Giờ vào<input name="work_start" type="time" defaultValue={d?.work_start ?? ""} className="mt-1 w-full rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[11.5px] text-neutral">Giờ ra<input name="work_end" type="time" defaultValue={d?.work_end ?? ""} className="mt-1 w-full rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[11.5px] text-neutral">Nghỉ trưa từ<input name="lunch_start" type="time" defaultValue={d?.lunch_start ?? ""} className="mt-1 w-full rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[11.5px] text-neutral">đến<input name="lunch_end" type="time" defaultValue={d?.lunch_end ?? ""} className="mt-1 w-full rounded-input border border-input bg-surface px-2 py-1.5 text-[13px]" /></label>
      </div>
    </div>
  );
}

export function LocationManager({ locations }: { locations: Loc[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const addRef = useRef<HTMLFormElement>(null);
  const editRef = useRef<HTMLFormElement>(null);

  function doAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(addRef.current!);
    start(async () => {
      const res = await addLocation(fd);
      if (res?.error) setError(res.error);
      else {
        addRef.current?.reset();
        router.refresh();
      }
    });
  }
  function doUpdate(id: string) {
    setError(null);
    const fd = new FormData(editRef.current!);
    start(async () => {
      const res = await updateLocation(id, fd);
      if (res?.error) setError(res.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }
  function doDelete(id: string) {
    if (!confirm("Xoá địa điểm này?")) return;
    start(async () => {
      const res = await deleteLocation(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-[12.5px] text-tint-tx-danger">⚠ {error}</div>}

      <form ref={addRef} onSubmit={doAdd} className="rounded-[11px] border border-dashed border-input p-3">
        <div className="mb-2 text-[12.5px] font-semibold text-brand">Thêm địa điểm</div>
        <LocFields />
        <button type="submit" disabled={pending} className="mt-2.5 inline-flex items-center gap-1.5 rounded-btn bg-primary px-3.5 py-2 text-[13px] font-semibold text-white">
          <Plus className="h-4 w-4" /> Thêm
        </button>
      </form>

      <div className="space-y-2">
        {locations.map((l) =>
          editing === l.id ? (
            <form key={l.id} ref={editRef} onSubmit={(e) => { e.preventDefault(); doUpdate(l.id); }} className="rounded-[11px] border border-primary p-3">
              <LocFields d={l} />
              <div className="mt-2.5 flex gap-2">
                <button type="submit" disabled={pending} className="rounded-btn bg-primary px-3.5 py-2 text-[13px] font-semibold text-white">Lưu</button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-btn border border-input px-3.5 py-2 text-[13px] font-semibold text-brand">Huỷ</button>
              </div>
            </form>
          ) : (
            <div key={l.id} className="flex items-center gap-3 rounded-[11px] border px-3.5 py-3">
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{l.name} {l.province ? <span className="text-[12px] font-normal text-neutral">· {l.province}</span> : null}</div>
                <div className="text-[12px] text-neutral">Giờ làm {hm(l.work_start)}–{hm(l.work_end)} · Nghỉ trưa {hm(l.lunch_start)}–{hm(l.lunch_end)}</div>
              </div>
              <button onClick={() => setEditing(l.id)} className="text-neutral hover:text-primary" aria-label="Sửa"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => doDelete(l.id)} disabled={pending} className="text-neutral hover:text-danger" aria-label="Xoá"><Trash2 className="h-4 w-4" /></button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
