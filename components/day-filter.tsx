"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

// Bộ lọc theo ngày: nút lùi/tới + chọn ngày. `today` truyền từ server để đồng nhất
// múi giờ; chặn chọn ngày tương lai.
export function DayFilter({
  date,
  today,
  action = "/cham-cong",
}: {
  date: string;
  today: string;
  action?: string;
}) {
  const router = useRouter();
  const go = (d: string) => {
    if (!d || d > today) return;
    router.push(`${action}?date=${d}`);
  };
  const shift = (delta: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    go(`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`);
  };
  const atMax = date >= today;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Ngày trước"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-input text-neutral hover:bg-app"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => go(e.target.value)}
        aria-label="Chọn ngày"
        className="rounded-input border border-input bg-surface px-2.5 py-1.5 text-[13px] text-ink"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={atMax}
        aria-label="Ngày sau"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-input text-neutral hover:bg-app disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
