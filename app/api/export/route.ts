import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/date-range";

function hm(s: string | null) {
  return s ? new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
}
function d(s: string | null) {
  return s ? new Date(s).toLocaleDateString("vi-VN") : "";
}

function xlsx(rows: any[], sheet: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "(trống)": "" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const type = sp.type ?? "attendance";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // ---- Danh sách nhân viên ----
  if (type === "employees") {
    const { data } = await supabase
      .from("profiles")
      .select("employee_code, full_name, email_company, phone, contract_type, work_status, account_status, role, department:departments(name), position:positions(name), title:titles(name)")
      .order("employee_code");
    const rows = (data ?? []).map((p: any) => ({
      "Mã NV": p.employee_code,
      "Họ tên": p.full_name,
      Email: p.email_company,
      "Điện thoại": p.phone,
      "Phòng ban": p.department?.name ?? "",
      "Vị trí": p.position?.name ?? "",
      "Chức vụ": p.title?.name ?? "",
      "Loại HĐ": p.contract_type ?? "",
      "Trạng thái": p.work_status,
      "Tài khoản": p.account_status,
      "Vai trò": p.role,
    }));
    return xlsx(rows, "Nhân sự", "nhan-su.xlsx");
  }

  // ---- Nghỉ phép ----
  if (type === "leave") {
    let q = supabase
      .from("leave_requests")
      .select("start_date, end_date, hours, status, reason, leave_type:leave_types(name), employee:profiles(full_name, employee_code)")
      .order("created_at", { ascending: false });
    if (sp.status) q = q.eq("status", sp.status);
    const { data } = await q;
    const rows = (data ?? []).map((r: any) => ({
      "Nhân viên": r.employee?.full_name ?? "",
      "Mã NV": r.employee?.employee_code ?? "",
      "Loại nghỉ": r.leave_type?.name ?? "",
      "Từ ngày": d(r.start_date),
      "Đến ngày": d(r.end_date),
      "Số giờ": r.hours ?? "",
      "Trạng thái": r.status,
      "Lý do": r.reason,
    }));
    return xlsx(rows, "Nghỉ phép", "nghi-phep.xlsx");
  }

  // ---- Chấm công (lịch sử / thống kê) ----
  const { from, toExclusive } = resolveRange(sp);
  let aq = supabase
    .from("attendance_records")
    .select("work_date, check_in_at, check_out_at, checkin_status, checkout_status, state, computed_workday, employee:profiles(full_name, employee_code, department_id, department:departments(name), position:positions(name), title:titles(name)), work_type:work_types(code)")
    .gte("work_date", from)
    .lt("work_date", toExclusive)
    .order("work_date", { ascending: false });
  let att = ((await aq).data ?? []) as any[];
  if (sp.department) att = att.filter((a) => a.employee?.department_id === sp.department);

  if (type === "attendance-stats") {
    const map = new Map<string, any>();
    for (const r of att) {
      const emp = r.employee ?? {};
      const key = emp.employee_code || emp.full_name || "—";
      const code = r.work_type?.code;
      const wd = Number(r.computed_workday || 0);
      const e =
        map.get(key) ??
        {
          code: emp.employee_code ?? "",
          name: emp.full_name ?? "—",
          dept: emp.department?.name ?? "",
          pos: emp.position?.name ?? "",
          title: emp.title?.name ?? "",
          days: 0,
          hc: 0,
          tc120: 0,
          tc150: 0,
          on: 0,
          late: 0,
          forgot: 0,
        };
      e.days++;
      if (code === "HC") e.hc += wd;
      else if (code === "TC120") e.tc120 += wd;
      else if (code === "TC150") e.tc150 += wd;
      else if (code === "ON") e.on += wd;
      if (r.checkin_status === "Trễ") e.late++;
      if (r.state === "missing_checkout") e.forgot++;
      map.set(key, e);
    }
    const rd = (n: number) => Math.round(n * 100) / 100;
    const rows = [...map.values()]
      .sort((a, b) => (a.dept + a.name).localeCompare(b.dept + b.name, "vi"))
      .map((e) => ({
        "Mã NV": e.code,
        "Họ tên": e.name,
        "Phòng ban": e.dept,
        "Vị trí": e.pos,
        "Chức vụ": e.title,
        "Số ngày chấm": e.days,
        "Công HC": rd(e.hc),
        "Công TC120": rd(e.tc120),
        "Công TC150": rd(e.tc150),
        "Công ON": rd(e.on),
        "Tổng công": rd(e.hc + e.tc120 + e.tc150 + e.on),
        "Đi trễ (lần)": e.late,
        "Quên check-out (lần)": e.forgot,
      }));
    if (rows.length) {
      const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
      rows.push({
        "Mã NV": "",
        "Họ tên": "TỔNG CỘNG",
        "Phòng ban": "",
        "Vị trí": "",
        "Chức vụ": "",
        "Số ngày chấm": sum("Số ngày chấm"),
        "Công HC": rd(sum("Công HC")),
        "Công TC120": rd(sum("Công TC120")),
        "Công TC150": rd(sum("Công TC150")),
        "Công ON": rd(sum("Công ON")),
        "Tổng công": rd(sum("Tổng công")),
        "Đi trễ (lần)": sum("Đi trễ (lần)"),
        "Quên check-out (lần)": sum("Quên check-out (lần)"),
      } as (typeof rows)[number]);
    }
    return xlsx(rows, "Bảng công tính lương", "bang-cong-tinh-luong.xlsx");
  }

  // mặc định: lịch sử chi tiết
  const rows = att.map((r: any) => ({
    Ngày: d(r.work_date),
    "Mã NV": r.employee?.employee_code ?? "",
    "Nhân viên": r.employee?.full_name ?? "",
    "Phòng ban": r.employee?.department?.name ?? "",
    "Vị trí": r.employee?.position?.name ?? "",
    "Giờ vào": hm(r.check_in_at),
    "Giờ ra": hm(r.check_out_at),
    Loại: r.work_type?.code ?? "",
    "Trạng thái vào": r.checkin_status ?? "",
    "Trạng thái": r.state === "missing_checkout" ? "Quên check-out" : "Hoàn tất",
    "Ngày công": r.state === "complete" ? Number(r.computed_workday) : "",
  }));
  return xlsx(rows, "Lịch sử chấm công", "lich-su-cham-cong.xlsx");
}
