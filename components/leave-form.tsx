"use client";

import { useRef, useState, useTransition } from "react";
import { createLeave } from "@/app/(app)/nghi-phep/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type LeaveType = {
  id: string;
  code: string;
  name: string;
  requires_attachment: boolean;
  is_half_day: boolean;
  max_hours: number | null;
};

export function LeaveForm({ types }: { types: LeaveType[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [sel, setSel] = useState<LeaveType | null>(types[0] ?? null);
  const [hours, setHours] = useState(1.5);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isHourly = sel?.code === "di_tre" || sel?.code === "ve_som";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const path = `leave/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("ho-so").upload(path, file);
    setUploading(false);
    if (error) return setError("Lỗi tải minh chứng: " + error.message);
    setAttachment(path);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sel) return setError("Chọn loại nghỉ.");
    const fd = new FormData(formRef.current!);
    fd.set("leave_type_id", sel.id);
    if (isHourly) fd.set("hours", String(hours));
    if (attachment) fd.set("attachment_url", attachment);
    start(async () => {
      const res = await createLeave(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div>
        <Label>Loại nghỉ</Label>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setSel(t)}
              className={
                "rounded-pill px-3 py-1.5 text-[12px] font-semibold " +
                (sel?.id === t.id ? "bg-primary text-white" : "border border-input bg-surface text-neutral")
              }
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {isHourly ? (
        <div className="space-y-3">
          <div>
            <Label>Ngày áp dụng</Label>
            <Input name="start_date" type="date" required />
          </div>
          <div>
            <Label>Số giờ {sel?.code === "di_tre" ? "đi trễ" : "về sớm"}</Label>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 rounded-input border border-primary bg-surface px-3.5 py-3 text-center font-mono text-[18px] font-semibold text-brand">
                {hours.toFixed(1)} h
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => setHours((h) => Math.min(3, +(h + 0.5).toFixed(1)))} className="h-8 w-8 rounded-md border border-input">+</button>
                <button type="button" onClick={() => setHours((h) => Math.max(0.5, +(h - 0.5).toFixed(1)))} className="h-8 w-8 rounded-md border border-input">−</button>
              </div>
            </div>
            <div className="mt-2 rounded-[9px] border border-tint-bd-warn bg-tint-warn px-3 py-2 text-[11.5px] text-tint-tx-warn">
              ⚠ Tối đa 3h. Trừ thẳng vào ngày công: 8/8 − {hours}/8 ={" "}
              <b>{((8 - hours) / 8).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}</b> (≈ {(8 - hours)}/8).
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <div className="flex-1">
            <Label>Từ ngày</Label>
            <Input name="start_date" type="date" required />
          </div>
          <div className="flex-1">
            <Label>Đến ngày</Label>
            <Input name="end_date" type="date" />
          </div>
        </div>
      )}

      {sel?.requires_attachment && (
        <div className="rounded-[11px] border border-dashed border-primary bg-tint-blue p-3">
          <div className="mb-2 text-[12.5px] font-bold text-brand">
            📎 Minh chứng (vd giấy bệnh viện) <span className="text-tint-tx-danger">* bắt buộc</span>
          </div>
          <label className="cursor-pointer text-[13px] font-semibold text-primary">
            {uploading ? "Đang tải lên…" : attachment ? "✓ Đã đính kèm — chọn lại" : "Chọn file"}
            <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        </div>
      )}

      <div>
        <Label>Lý do *</Label>
        <textarea
          name="reason"
          required
          rows={3}
          placeholder="Nhập lý do…"
          className="w-full rounded-input border border-input bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
        />
      </div>

      {error && <div className="text-[13px] text-tint-tx-danger">⚠ {error}</div>}

      <Button type="submit" size="block" disabled={pending || uploading}>
        {pending ? "Đang gửi…" : "Gửi đơn"}
      </Button>
      <div className="text-center text-[11px] text-muted">Luồng nghỉ phép: Nhân viên → Quản lý (cấp cuối)</div>
    </form>
  );
}
