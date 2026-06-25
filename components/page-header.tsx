import Link from "next/link";

export type Crumb = { label: string; href?: string };

// Header chuẩn cho các trang con: breadcrumb + tiêu đề (cùng cỡ/khoảng cách) + action bên phải.
export function PageHeader({
  crumbs,
  title,
  action,
}: {
  crumbs: Crumb[];
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted">›</span>}
            {c.href ? (
              <Link href={c.href} className="text-neutral hover:text-primary">
                {c.label}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h1 className="text-[18px] font-extrabold text-brand">{title}</h1> : <span />}
          {action && <div className="flex flex-wrap items-end gap-2">{action}</div>}
        </div>
      )}
    </div>
  );
}
