"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { setEmployeeLocations } from "@/app/(app)/nhan-su/actions";

type Row = { location_id: string; shift_id: string };

function hm(t?: string | null) {
  return t ? String(t).slice(0, 5) : "—";
}

export function EmployeeLocationsEditor({
  employeeId,
  initial,
  catalogs,
  canEdit,
}: {
  employeeId: string;
  initial: any[];
  catalogs: { locations: any[]; shifts: any[] };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(
    initial.map((l) => ({ location_id: l.location_id, shift_id: l.shift_id ?? "" }))
  );

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("locations_json", JSON.stringify(rows));
    start(async () => {
      const res = await setEmployeeLocations(employeeId, fd);
      if (res?.error) setError(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  // ----- Chế độ xem -----
  if (!editing) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[13px] font-bold text-brand">
            Địa điểm làm việc{" "}
            <span className="text-[11.5px] font-normal text-muted">· chọn nhiều, mỗi nơi gắn ca + nghỉ trưa</span>
          </div>
          {canEdit && (
            <button onClick={() => setEditing(true)} className="text-[12.5px] font-semibold text-primary">
              Sửa địa điểm
            </button>
          )}
        </div>
        {initial.length === 0 ? (
          <div className="text-[13px] text-muted">Chưa gán địa điểm.</div>
        ) : (
          <div className="space-y-2.5">
            {initial.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-[10px] bg-app p-3">
                <span className="rounded-md bg-tint-blue px-2.5 py-1 text-[12px] font-bold text-tint-tx-blue">
                  {l.location?.name}
                </span>
                {l.location?.province && (
                  <span className="text-[12px] text-neutral">{l.location.province}</span>
                )}
                <span className="text-[13px] text-ink">
                  {l.shift?.name ?? "—"} · {hm(l.shift?.start_time)}–{hm(l.shift?.end_time)}
                </span>
                <span className="ml-auto text-[12.5px] text-neutral">
                  Nghỉ trưa {hm(l.location?.lunch_start)}–{hm(l.location?.lunch_end)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ----- Chế độ sửa -----
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-bold text-brand">Sửa địa điểm làm việc</div>
        <button
          onClick={() => setRows((r) => [...r, { location_id: "", shift_id: "" }])}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
        >
          <Plus className="h-4 w-4" /> Thêm địa điểm
        </button>
      </div>
      {rows.length === 0 && <div className="text-[12.5px] text-muted">Chưa gán địa điểm nào.</div>}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-app p-2.5">
            <select
              value={row.location_id}
              onChange={(e) => setRows((l) => l.map((r, j) => (j === i ? { ...r, location_id: e.target.value } : r)))}
              className="flex-1 rounded-md border border-input bg-surface px-2.5 py-2 text-[13px]"
            >
              <option value="">— Chọn địa điểm —</option>
              {catalogs.locations.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
            <select
              value={row.shift_id}
              onChange={(e) => setRows((l) => l.map((r, j) => (j === i ? { ...r, shift_id: e.target.value } : r)))}
              className="flex-1 rounded-md border border-input bg-surface px-2.5 py-2 text-[13px]"
            >
              <option value="">— Ca (tuỳ chọn) —</option>
              {catalogs.shifts.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
            <button onClick={() => setRows((l) => l.filter((_, j) => j !== i))} className="text-muted hover:text-danger" aria-label="Xoá">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {error && <div className="mt-2 text-[12.5px] text-tint-tx-danger">⚠ {error}</div>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={pending} className="rounded-btn bg-primary px-3.5 py-2 text-[13px] font-semibold text-white">
          {pending ? "Đang lưu…" : "Lưu địa điểm"}
        </button>
        <button onClick={() => setEditing(false)} className="rounded-btn border border-input px-3.5 py-2 text-[13px] font-semibold text-brand">
          Huỷ
        </button>
      </div>
    </div>
  );
}
