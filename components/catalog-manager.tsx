"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { addCatalogItem, deleteCatalogItem } from "@/app/(app)/nhan-su/actions";
import { updateCatalogItem } from "@/app/(app)/cau-hinh/actions";
import type { Catalog } from "@/lib/queries";

type Table = "departments" | "positions" | "titles";

export function CatalogManager({ table, items }: { table: Table; items: Catalog[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const addRef = useRef<HTMLFormElement>(null);
  const editRef = useRef<HTMLFormElement>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(addRef.current!);
    start(async () => {
      const res = await addCatalogItem(table, fd);
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
      const res = await updateCatalogItem(table, id, fd);
      if (res?.error) setError(res.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }
  function remove(id: string) {
    if (!confirm("Xoá mục này?")) return;
    start(async () => {
      const res = await deleteCatalogItem(table, id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <form ref={addRef} onSubmit={add} className="flex gap-2">
        <input name="name" placeholder="Tên mục mới…" className="flex-1 rounded-input border border-input bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-primary" />
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-btn bg-primary px-3.5 py-2 text-[13px] font-semibold text-white">
          <Plus className="h-4 w-4" /> Thêm
        </button>
      </form>
      {error && <div className="text-[12px] text-tint-tx-danger">⚠ {error}</div>}
      <div className="space-y-2">
        {items.length === 0 && <div className="text-[13px] text-muted">Chưa có mục nào.</div>}
        {items.map((it) =>
          editing === it.id ? (
            <form key={it.id} ref={editRef} onSubmit={(e) => { e.preventDefault(); save(it.id); }} className="flex gap-2 rounded-[10px] border border-primary px-3 py-2">
              <input name="name" defaultValue={it.name} className="flex-1 rounded-md border border-input bg-surface px-2.5 py-1.5 text-[13.5px] outline-none focus:border-primary" />
              <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white">Lưu</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-input px-3 py-1.5 text-[12.5px] font-semibold text-brand">Huỷ</button>
            </form>
          ) : (
            <div key={it.id} className="flex items-center justify-between rounded-[10px] border px-3.5 py-2.5">
              <span className="text-[13.5px] text-ink">{it.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(it.id)} className="text-muted hover:text-primary" aria-label="Sửa"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(it.id)} disabled={pending} className="text-muted hover:text-danger" aria-label="Xoá"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
