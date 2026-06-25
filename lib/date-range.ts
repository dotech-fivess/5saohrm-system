// Giải nghĩa tham số lọc: ưu tiên khoảng (from/to), nếu không thì theo tháng.
export function resolveRange(sp: { month?: string; from?: string; to?: string }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextDay = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  };

  if (sp.from || sp.to) {
    const from = (sp.from || sp.to)!;
    const endIncl = (sp.to || sp.from)!;
    return { from, toExclusive: nextDay(endIncl), label: `${from} → ${endIncl}`, month: sp.month ?? "" };
  }

  const now = new Date();
  const month = sp.month || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${pad(m)}-01`;
  const toExclusive = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { from, toExclusive, label: `Tháng ${m}/${y}`, month };
}
