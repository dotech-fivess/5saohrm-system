// Kiểm tra quyền duyệt theo mô hình mới:
//  - Trưởng phòng KHÁC phòng: bị chặn.  - Trưởng phòng ĐÚNG phòng: được.
//  - quan_ly (HR/BLD): duyệt TOÀN CÔNG TY (đơn phòng nào cũng được).
import pg from "pg";
const client = new pg.Client({ ssl: { rejectUnauthorized: false } });
const q = async (sql, p) => (await client.query(sql, p)).rows;
const uid = async (e) => (await q(`select id from auth.users where email=$1`, [e]))[0]?.id;
const asUser = async (id) => client.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: id })]);

async function newItFlow(itEmp) {
  const [{ id: reqId }] = await q(
    `insert into leave_requests(employee_id,leave_type_id,start_date,end_date,reason,status)
     values ($1,(select id from leave_types where code='nghi_benh'),current_date,current_date,'TEST','Chờ') returning id`, [itEmp]);
  await asUser(itEmp);
  const [{ submit_request: flow }] = await q(`select submit_request('leave',$1)`, [reqId]);
  return flow;
}
async function tryDecide(actor, flow) {
  await asUser(actor);
  await client.query("savepoint sp");
  try { await q(`select decide_request($1,'Duyệt',null)`, [flow]); return { ok: true }; }
  catch (e) { await client.query("rollback to savepoint sp"); return { ok: false, msg: e.message }; }
}

try {
  await client.connect();
  await client.query("begin");
  const itEmp = await uid("nv4@test.5sao.vn");   // NV IT
  const itHead = await uid("nv1@test.5sao.vn");  // Trưởng phòng IT
  const mktHead = await uid("nv2@test.5sao.vn"); // Trưởng phòng Marketing
  const hrBld = await uid("minh.ql@test.5sao.vn"); // quan_ly = HR/BLD

  let flow = await newItFlow(itEmp);
  const r1 = await tryDecide(mktHead, flow);
  console.log("1) Trưởng phòng Marketing duyệt đơn IT → bị chặn:", !r1.ok, r1.msg ? `("${r1.msg}")` : "");

  const r2 = await tryDecide(itHead, flow);
  console.log("2) Trưởng phòng IT duyệt đơn IT        → thành công:", r2.ok, r2.msg ? `(lỗi: ${r2.msg})` : "");

  // quan_ly (HR/BLD) duyệt đơn IT trên flow mới → phải được
  flow = await newItFlow(itEmp);
  const r3 = await tryDecide(hrBld, flow);
  console.log("3) HR/BLD (quan_ly) duyệt đơn IT       → thành công:", r3.ok, r3.msg ? `(lỗi: ${r3.msg})` : "");

  await client.query("rollback");
  console.log("\n(rolled back)");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("LỖI:", e.message); process.exitCode = 1;
} finally { await client.end(); }
