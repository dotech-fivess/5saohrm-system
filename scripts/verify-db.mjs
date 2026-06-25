import pg from "pg";
const client = new pg.Client({ ssl: { rejectUnauthorized: false } });
const q = async (label, sql) => {
  const r = await client.query(sql);
  console.log(label + ":", JSON.stringify(r.rows));
};
try {
  await client.connect();
  await q("work_types", "select code, coefficient from work_types order by code");
  await q("leave_types (count)", "select count(*)::int as n from leave_types");
  await q("config_parameters (count)", "select count(*)::int as n from config_parameters");
  await q("functions", `select proname from pg_proc where proname in
    ('attendance_checkin','attendance_checkout','submit_request','decide_request','finalize_request','fn_compute_workday')
    order by proname`);
  await q("compute HC 360'", "select fn_compute_workday('HC', 360) as v");
  await q("compute ON 360'", "select fn_compute_workday('ON', 360) as v");
  await q("rls profiles", "select relrowsecurity from pg_class where relname='profiles'");
} catch (e) {
  console.error("ERR:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
