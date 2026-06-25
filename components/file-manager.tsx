"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Eye, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordEmployeeFile, deleteEmployeeFile, getFileUrl } from "@/app/(app)/nhan-su/actions";
import { StatusBadge } from "@/components/ui/status-badge";

const DOC_TYPES = ["CCCD", "Hợp đồng", "CV", "Cam kết"];

type FileRow = { id: string; doc_type: string; file_name: string | null; storage_path: string; version: number };

export function FileManager({ employeeId, files }: { employeeId: string; files: FileRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byType = new Map(files.map((f) => [f.doc_type, f]));

  async function upload(docType: string, file: File) {
    setBusy(docType);
    setError(null);
    const supabase = createClient();
    const path = `${employeeId}/${docType}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("ho-so").upload(path, file);
    if (upErr) {
      setBusy(null);
      return setError("Lỗi tải lên: " + upErr.message);
    }
    const fd = new FormData();
    fd.set("doc_type", docType);
    fd.set("storage_path", path);
    fd.set("file_name", file.name);
    fd.set("size", String(file.size));
    const res = await recordEmployeeFile(employeeId, fd);
    setBusy(null);
    if (res?.error) return setError(res.error);
    router.refresh();
  }

  async function view(path: string) {
    const res = await getFileUrl(path);
    if (res.url) window.open(res.url, "_blank");
    else setError(res.error ?? "Không mở được file.");
  }

  function remove(id: string) {
    if (!confirm("Xoá tài liệu này?")) return;
    start(async () => {
      const res = await deleteEmployeeFile(employeeId, id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      {error && <div className="text-[12.5px] text-tint-tx-danger">⚠ {error}</div>}
      {DOC_TYPES.map((dt) => {
        const f = byType.get(dt);
        return (
          <div key={dt} className="flex items-center gap-3 rounded-[11px] border p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[9px] bg-tint-blue text-tint-tx-blue">
              <FileText className="h-[18px] w-[18px]" />
            </div>
            <div className="flex-1 truncate">
              <div className="text-[13.5px] font-semibold text-ink">{dt}</div>
              <div className="truncate text-[12px] text-neutral">
                {f ? `${f.file_name ?? "tệp"}${f.version > 1 ? ` · v${f.version}` : ""}` : "Chưa tải lên"}
              </div>
            </div>
            {f ? (
              <StatusBadge tone="success" dot={false}>Đã có</StatusBadge>
            ) : (
              <StatusBadge tone="warning" dot={false}>Chưa tải</StatusBadge>
            )}
            <div className="flex items-center gap-1.5">
              {f && (
                <>
                  <button onClick={() => view(f.storage_path)} className="rounded-md p-1.5 text-neutral hover:text-primary" aria-label="Xem">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(f.id)} disabled={pending} className="rounded-md p-1.5 text-neutral hover:text-danger" aria-label="Xoá">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-btn bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-white">
                <Upload className="h-3.5 w-3.5" />
                {busy === dt ? "…" : f ? "Thay" : "Tải lên"}
                <input
                  type="file"
                  className="hidden"
                  disabled={busy === dt}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(dt, file);
                  }}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
