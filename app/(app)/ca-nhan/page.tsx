import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { type Profile, ROLE_LABEL } from "@/lib/types";

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();
  const profile = data as Profile | null;

  const rows = [
    ["Mã NV", profile?.employee_code ?? "—"],
    ["Email", profile?.email_company ?? user?.email ?? "—"],
    ["Điện thoại", profile?.phone ?? "—"],
    ["Vai trò", profile ? ROLE_LABEL[profile.role] : "—"],
  ];

  return (
    <div className="space-y-3.5">
      <Card className="rounded-[14px]">
        <CardBody className="px-4 py-1.5">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between border-b border-divider py-3 last:border-0"
            >
              <span className="text-[13px] text-neutral">{k}</span>
              <span className="text-[13px] text-ink">{v}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
