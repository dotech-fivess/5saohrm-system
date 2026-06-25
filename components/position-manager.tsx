"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { addPosition, updatePosition, deletePosition } from "@/app/(app)/cau-hinh/actions";
import type { Catalog } from "@/lib/queries";

type Pos = { id: string; name: string; department_id: string | null };

export function PositionManager({
  positions,
  departments,
}: {
  positions: Pos[];
  departments: Catalog[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dept, setDept] = useState(departments[0]?.id ?? "");
  const [editing, setEditing] = useState<string | null>(null);
  const addRef = useRef<HTMLFormElement>(null);
  const editRef = useRef<HTMLFormElement>(null);

  const list = positions.filter((p) => p.department_id === dept);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(addRef.current!);
    fd.set("department_id", dept);
    start(async () => {
      const res = await addPosition(fd);
      if (res?.error) setError(res.error);
      else {
        addRef.current?.reset();
        router.refresh();
      }
    });
  }
  function save(id: string) {
    setError(null);
    const fd = new FormData(editRef.current!);
    start(async () => {
      const res = await updatePosition(id, fd);
      if (res?.error) setError(res.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }
  function remove(id: string) {
    if (!confirm("Xoá vị trí này?")) return;
    start(async () => {
      const res = await deletePosition(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Chọn phòng ban để quản lý vị trí */}
      <div>
        <div className="mb-1.5 text-[12.5px] font-medium text-neutral">Phòng ban</div>
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDept(d.id);
                setEditing(null);
                setError(null);
              }}
              className={
                "rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold " +
                (dept === d.id ? "bg-primary text-white" : "border bg-surface text-neutral")
              }
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="text-[13px] text-muted">Chưa có phòng ban. Tạo phòng ban trước ở tab "Phòng ban".</div>
      ) : (
        <>
          <form ref={addRef} onSubmit={add} className="flex gap-2">
            <input
              name="name"
              placeholder={`Thêm vị trí cho phòng ban đã chọn…`}
              className="flex-1 rounded-input border border-input bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
            <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-btn bg-primary px-3.5 py-2 text-[13px] font-semibold text-white">
              <Plus className="h-4 w-4" /> Thêm
            </button>
          </form>
          {error && <div className="text-[12px] text-tint-tx-danger">⚠ {error}</div>}

          <div className="space-y-2">
            {list.length === 0 && <div className="text-[13px] text-muted">Phòng ban này chưa có vị trí nào.</div>}
            {list.map((p) =>
              editing === p.id ? (
                <form key={p.id} ref={editRef} onSubmit={(e) => { e.preventDefault(); save(p.id); }} className="flex flex-wrap gap-2 rounded-[10px] border border-primary px-3 py-2">
                  <input name="name" defaultValue={p.name} className="flex-1 rounded-md border border-input bg-surface px-2.5 py-1.5 text-[13.5px]" />
                  <select name="department_id" defaultValue={p.department_id ?? dept} className="rounded-md border border-input bg-surface px-2.5 py-1.5 text-[13px]">
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white">Lưu</button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-input px-3 py-1.5 text-[12.5px] font-semibold text-brand">Huỷ</button>
                </form>
              ) : (
                <div key={p.id} className="flex items-center justify-between rounded-[10px] border px-3.5 py-2.5">
                  <span className="text-[13.5px] text-ink">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing(p.id)} className="text-muted hover:text-primary" aria-label="Sửa"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(p.id)} disabled={pending} className="text-muted hover:text-danger" aria-label="Xoá"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
