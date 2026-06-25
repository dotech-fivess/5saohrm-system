"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

// Bộ lọc tháng gọn cho trang chủ: nút lùi/tới + chọn tháng. Chặn chọn tháng tương lai.
export function MonthFilter({ month }: { month: string }) {
  const router = useRouter();
  const now = new Date();
  const maxMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  const go = (m: string) => {
    if (!m || m > maxMonth) return;
    router.push(`/?month=${m}`);
  };
  const shift = (delta: number) => {
    const [y, mm] = month.split("-").map(Number);
    const d = new Date(y, mm - 1 + delta, 1);
    go(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const atMax = month >= maxMonth;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Tháng trước"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px] border border-input text-neutral hover:bg-app"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="month"
        value={month}
        max={maxMonth}
        onChange={(e) => go(e.target.value)}
        aria-label="Chọn tháng"
        className="rounded-input border border-input bg-surface px-2 py-1 text-[12.5px] text-ink"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={atMax}
        aria-label="Tháng sau"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px] border border-input text-neutral hover:bg-app disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
