import Link from "next/link";

// Bộ lọc theo tháng HOẶC khoảng ngày. Là form GET (server-friendly).
export function DateRangeFilter({
  action,
  month,
  from,
  to,
  departments,
  department,
}: {
  action: string;
  month?: string;
  from?: string;
  to?: string;
  departments?: { id: string; name: string }[];
  department?: string;
}) {
  const hasFilter = !!(month || from || to || department);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {departments && (
        <label className="text-[11.5px] text-neutral">
          Phòng ban
          <select
            name="department"
            defaultValue={department ?? ""}
            className="ml-1 rounded-input border border-input bg-surface px-2.5 py-1.5 text-[13px]"
          >
            <option value="">Tất cả</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="text-[11.5px] text-neutral">
        Tháng
        <input
          type="month"
          name="month"
          defaultValue={month}
          className="ml-1 rounded-input border border-input bg-surface px-2.5 py-1.5 text-[13px]"
        />
      </label>
      <span className="pb-1.5 text-[12px] text-muted">hoặc khoảng</span>
      <label className="text-[11.5px] text-neutral">
        Từ
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="ml-1 rounded-input border border-input bg-surface px-2.5 py-1.5 text-[13px]"
        />
      </label>
      <label className="text-[11.5px] text-neutral">
        Đến
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="ml-1 rounded-input border border-input bg-surface px-2.5 py-1.5 text-[13px]"
        />
      </label>
      <button className="rounded-btn bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white">
        Lọc
      </button>
      {hasFilter && (
        <Link href={action} className="pb-1 text-[12.5px] font-semibold text-neutral hover:text-primary">
          Xoá lọc
        </Link>
      )}
    </form>
  );
}
