import { Download } from "lucide-react";

// Nút tải Excel — là <a> trỏ tới /api/export (server tạo file theo session/RLS).
export function ExportButton({ href, label = "Xuất Excel" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-btn border border-input bg-surface px-3.5 py-2 text-[13px] font-semibold text-brand hover:bg-app"
    >
      <Download className="h-4 w-4" /> {label}
    </a>
  );
}
