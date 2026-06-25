import { createClient } from "@/lib/supabase/server";
import { getCatalogs } from "@/lib/queries";
import { DashboardView } from "@/components/dashboard-view";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string; department?: string };
}) {
  const supabase = createClient();
  const catalogs = await getCatalogs();

  const now = new Date();
  const month = searchParams.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const dept = searchParams.department || "";
  const deptName = catalogs.departments.find((x) => x.id === dept)?.name ?? "";

  // ---- Nhân sự ----
  let pq = supabase.from("profiles").select("id, contract_type, department:departments(name)");
  if (dept) pq = pq.eq("department_id", dept);
  const profiles = ((await pq).data ?? []) as any[];

  const totalStaff = profiles.length;
  const byContract = {
    "Chính thức": profiles.filter((p) => p.contract_type === "Chính thức").length,
    "Thử việc": profiles.filter((p) => p.contract_type === "Thử việc").length,
    TTS: profiles.filter((p) => p.contract_type === "TTS").length,
  };
  // Hồ sơ chưa gán loại HĐ → gộp vào "Khác" để breakdown luôn khớp tổng
  const otherContract = totalStaff - byContract["Chính thức"] - byContract["Thử việc"] - byContract.TTS;
  // Bucket null thành "Chưa phân loại" để tổng theo phòng ban/địa điểm khớp tổng nhân sự
  const byDept = topCounts(profiles.map((p) => p.department?.name ?? "Chưa phân loại"));
  const empLocs = ((await supabase.from("employee_locations").select("location:locations(name)")).data ?? []) as any[];
  const byLoc = topCounts(empLocs.map((e) => e.location?.name ?? "Chưa phân loại"));

  // ---- Chấm công (tháng) ----
  let att = ((
    await supabase
      .from("attendance_records")
      .select("checkin_status, state, computed_workday, employee:profiles(full_name, department_id), work_type:work_types(code)")
      .gte("work_date", from)
      .lt("work_date", to)
  ).data ?? []) as any[];
  if (dept) att = att.filter((a) => a.employee?.department_id === dept);

  const lateTop = topByEmployee(att.filter((a) => a.checkin_status === "Trễ"), (a) => a.employee?.full_name);
  const forgotTop = topByEmployee(att.filter((a) => a.state === "missing_checkout"), (a) => a.employee?.full_name);
  const otTop = topByEmployee(att.filter((a) => ["TC120", "TC150"].includes(a.work_type?.code)), (a) => a.employee?.full_name);

  // ---- Nghỉ phép (tháng) ----
  let leaves = ((
    await supabase
      .from("leave_requests")
      .select("status, leave_type:leave_types(name), employee:profiles(full_name, department_id)")
      .gte("start_date", from)
      .lt("start_date", to)
  ).data ?? []) as any[];
  if (dept) leaves = leaves.filter((l) => l.employee?.department_id === dept);

  const byLeaveType = topCounts(leaves.map((l) => l.leave_type?.name).filter(Boolean), 6);
  const leaveTop = topByEmployee(leaves, (l) => l.employee?.full_name);

  return (
    <DashboardView
      month={month}
      m={m}
      y={y}
      dept={dept}
      deptName={deptName}
      departments={catalogs.departments}
      totalStaff={totalStaff}
      byContract={byContract}
      otherContract={otherContract}
      byDept={byDept}
      byLoc={byLoc}
      lateTop={lateTop}
      forgotTop={forgotTop}
      otTop={otTop}
      byLeaveType={byLeaveType}
      leaveTop={leaveTop}
    />
  );
}

// ---------- helpers (tính toán) ----------
function topCounts(items: string[], limit = 5): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}
function topByEmployee(rows: any[], pick: (r: any) => string | undefined, limit = 5) {
  return topCounts(rows.map(pick).filter(Boolean) as string[], limit);
}
