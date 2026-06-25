import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployee, getCatalogs } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountStatusButton } from "@/components/account-status-button";
import { FileManager } from "@/components/file-manager";
import { EmployeeLocationsEditor } from "@/components/employee-locations-editor";
import { PageHeader } from "@/components/page-header";
import { ROLE_LABEL, type Role, type Profile } from "@/lib/types";

const TABS = [
  { key: "basic", label: "Thông tin cơ bản" },
  { key: "work", label: "Thông tin công việc" },
  { key: "system", label: "Thông tin hệ thống" },
  { key: "files", label: "File hồ sơ" },
];

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const { profile, locations, files, activity } = await getEmployee(params.id);
  if (!profile) notFound();
  const tab = searchParams.tab ?? "basic";

  const catalogs = await getCatalogs();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const canEdit = (me as Profile | null)?.role === "qt_sua";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          crumbs={[{ label: "Nhân sự", href: "/nhan-su" }, { label: profile.full_name }]}
          action={
            <>
              <Link href={`/nhan-su/${params.id}/sua`}>
                <Button variant="secondary" size="sm">Chỉnh sửa</Button>
              </Link>
              <AccountStatusButton id={params.id} status={profile.account_status} />
            </>
          }
        />

        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-tint-blue text-[22px] font-extrabold text-tint-tx-blue">
                {initials(profile.full_name)}
              </div>
              <div className="flex-1">
                <div className="text-[19px] font-extrabold text-brand">
                  {profile.full_name}
                </div>
                <div className="text-[13px] text-neutral">
                  {profile.employee_code} · {profile.position?.name ?? "—"} ·{" "}
                  {profile.department?.name ?? "—"}
                </div>
              </div>
              <StatusBadge tone={profile.work_status === "Đang làm" ? "success" : "neutral"} dot={false}>
                {profile.work_status}
              </StatusBadge>
            </div>

            {/* Tabs */}
            <div className="mt-5 flex gap-1 border-b">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={`/nhan-su/${params.id}?tab=${t.key}`}
                  className={
                    "px-3.5 py-2.5 text-[13.5px] " +
                    (tab === t.key
                      ? "border-b-2 border-primary font-bold text-primary"
                      : "text-neutral")
                  }
                >
                  {t.label}
                </Link>
              ))}
            </div>

            <div className="pt-5">
              {tab === "basic" && (
                <FieldGrid
                  rows={[
                    ["Email", profile.email_company],
                    ["Điện thoại", profile.phone],
                    ["Giới tính", profile.gender],
                    ["Ngày sinh", profile.dob],
                    ["Địa chỉ", profile.address],
                  ]}
                />
              )}
              {tab === "work" && (
                <div className="space-y-4">
                  <FieldGrid
                    rows={[
                      ["Phòng ban", profile.department?.name],
                      ["Vị trí · Chức vụ", `${profile.position?.name ?? "—"} · ${profile.title?.name ?? "—"}`],
                      ["Loại hợp đồng", profile.contract_type],
                      ["Ngày vào · thử việc · chính thức", `${profile.join_date ?? "—"} · ${profile.probation_date ?? "—"} · ${profile.official_date ?? "—"}`],
                    ]}
                  />
                  <EmployeeLocationsEditor
                    employeeId={params.id}
                    initial={locations}
                    catalogs={{ locations: catalogs.locations, shifts: catalogs.shifts }}
                    canEdit={canEdit}
                  />
                </div>
              )}
              {tab === "system" && (
                <FieldGrid
                  rows={[
                    ["Email đăng nhập", profile.email_company],
                    ["Vai trò", ROLE_LABEL[profile.role as Role]],
                    ["Trạng thái tài khoản", profile.account_status],
                  ]}
                />
              )}
              {tab === "files" && <FileManager employeeId={params.id} files={files} />}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Lịch sử hoạt động (S8) */}
      <Card className="h-fit">
        <CardBody>
          <div className="mb-3 text-[15px] font-extrabold text-brand">
            Lịch sử hoạt động
          </div>
          {activity.length === 0 ? (
            <div className="text-[13px] text-muted">Chưa có hoạt động.</div>
          ) : (
            <div className="relative space-y-5 pl-6">
              <div className="absolute bottom-1.5 left-[7px] top-1.5 w-0.5 bg-divider" />
              {activity.map((a, i) => (
                <div key={a.id} className="relative">
                  <div
                    className={
                      "absolute -left-6 top-0.5 h-4 w-4 rounded-full border-[3px] border-white " +
                      (i === 0 ? "bg-primary ring-1 ring-primary" : "bg-[#cdd6d1]")
                    }
                  />
                  <div className="text-[13.5px] font-semibold text-ink">{a.action}</div>
                  {diffFields(a.before, a.after).map((line) => (
                    <div key={line} className="text-[12px] text-neutral">{line}</div>
                  ))}
                  <div className="text-[11.5px] text-muted">
                    {a.actor?.full_name ? `bởi ${a.actor.full_name} · ` : ""}
                    {new Date(a.created_at).toLocaleString("vi-VN")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function FieldGrid({ rows }: { rows: [string, any][] }) {
  return (
    <div className="divide-y divide-divider">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-2.5">
          <span className="text-[13px] text-neutral">{k}</span>
          <span className="text-[13px] text-ink">{v || "—"}</span>
        </div>
      ))}
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  full_name: "Họ tên",
  phone: "SĐT",
  gender: "Giới tính",
  dob: "Ngày sinh",
  address: "Địa chỉ",
  contract_type: "Loại HĐ",
  work_status: "Trạng thái",
  role: "Vai trò",
  account_status: "Tài khoản",
  join_date: "Ngày vào",
  probation_date: "Ngày thử việc",
  official_date: "Ngày chính thức",
};

function diffFields(before: any, after: any): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const out: string[] = [];
  for (const k of Object.keys(FIELD_LABEL)) {
    if (!(k in after)) continue;
    const b = before[k] ?? null;
    const a = after[k] ?? null;
    if (String(b) !== String(a)) out.push(`${FIELD_LABEL[k]}: ${b ?? "—"} → ${a ?? "—"}`);
  }
  return out.slice(0, 6);
}

function fmt(t?: string | null) {
  return t ? t.slice(0, 5) : "—";
}
function initials(name: string) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "NV"
  );
}
