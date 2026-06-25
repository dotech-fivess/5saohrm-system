import pg from "pg";
const c = new pg.Client({ ssl: { rejectUnauthorized: false } });
const q = async (label, sql) => console.log("\n# " + label + "\n" + JSON.stringify((await c.query(sql)).rows));
await c.connect();
try {
  await q("Tổng profiles", "select count(*)::int n from profiles");
  await q("Theo contract_type (gồm null)", "select contract_type, count(*)::int n from profiles group by contract_type order by n desc");
  await q("Theo department (gồm null)", "select d.name, count(*)::int n from profiles p left join departments d on d.id=p.department_id group by d.name order by n desc");
  await q("NV có gán địa điểm", "select count(distinct employee_id)::int n from employee_locations");
  await q("Attendance tháng này", "select count(*)::int n from attendance_records where work_date >= date_trunc('month', current_date)::date");
  await q("Leave tháng này (theo start_date)", "select count(*)::int n from leave_requests where start_date >= date_trunc('month', current_date)::date");
  await q("Leave tổng (mọi trạng thái)", "select status, count(*)::int n from leave_requests group by status");
  await q("Adjustments tổng", "select status, count(*)::int n from attendance_adjustments group by status");
  await q("Notifications tổng", "select count(*)::int n from notifications");
  await q("work_date range", "select min(work_date) mn, max(work_date) mx, current_date today from attendance_records");
} catch (e) { console.error("ERR", e.message); } finally { await c.end(); }
