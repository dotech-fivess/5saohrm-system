import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { markAllRead } from "./actions";

export default async function Page() {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as any[];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="mx-auto max-w-[640px] space-y-4">
      <div className="flex items-center justify-end">
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="rounded-btn border border-input bg-surface px-3.5 py-2 text-[13px] font-semibold text-brand">
              Đánh dấu đã đọc ({unread})
            </button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Bell className="h-7 w-7 text-muted" />
          <div className="text-[13px] text-muted">Chưa có thông báo nào.</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id} className={"p-3.5 " + (n.read_at ? "" : "border-l-4 border-l-primary")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13.5px] font-bold text-ink">{n.title}</div>
                  <div className="text-[12.5px] text-neutral">{n.body}</div>
                </div>
                {!n.read_at && <span className="mt-1 h-2 w-2 flex-none rounded-full bg-primary" />}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {new Date(n.created_at).toLocaleString("vi-VN")}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
