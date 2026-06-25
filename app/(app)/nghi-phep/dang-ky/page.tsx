import { createClient } from "@/lib/supabase/server";
import { LeaveForm } from "@/components/leave-form";
import { PageHeader } from "@/components/page-header";

export default async function Page() {
  const supabase = createClient();
  const { data } = await supabase
    .from("leave_types")
    .select("id, code, name, requires_attachment, is_half_day, max_hours")
    .order("created_at");

  return (
    <div className="mx-auto max-w-[520px] space-y-4">
      <PageHeader
        crumbs={[{ label: "Nghỉ phép", href: "/nghi-phep" }, { label: "Đăng ký" }]}
        title="Xin nghỉ phép"
      />
      <LeaveForm types={(data ?? []) as any[]} />
    </div>
  );
}
