// Kiểm tra định tuyến đơn về trưởng phòng (0010). Chạy trong transaction rồi ROLLBACK.
import pg from "pg";
const client = new pg.Client({ ssl: { rejectUnauthorized: false } });

const q = async (sql, params) => (await client.query(sql, params)).rows;
const uid = async (email) => (await q(`select id from auth.users where email=$1`, [email]))[0]?.id;

try {
  await client.connect();
  await client.query("begin");

  const itEmp = await uid("nv4@test.5sao.vn");   // IT, KHÔNG phải trưởng phòng
  const itHead = await uid("nv1@test.5sao.vn");  // IT head
  const mktHead = await uid("nv2@test.5sao.vn"); // Marketing head
  const kdHead = await uid("minh.ql@test.5sao.vn"); // Kinh doanh head

  // xác nhận phòng ban + chức vụ của head
  const heads = await q(
    `select u.email, d.name dept, t.name title, p.role
       from profiles p join auth.users u on u.id=p.id
       left join departments d on d.id=p.department_id
       left join titles t on t.id=p.title_id
      where u.email in ('nv1@test.5sao.vn','nv2@test.5sao.vn','minh.ql@test.5sao.vn','nv4@test.5sao.vn')
      order by u.email`
  );
  console.log("Vai trò/chức vụ:");
  for (const h of heads) console.log(`  ${h.email}  | ${h.dept} | ${h.title} | ${h.role}`);

  // tạo đơn nghỉ cho NV IT rồi gọi submit_request dưới danh nghĩa NV đó
  const [{ id: reqId }] = await q(
    `insert into leave_requests(employee_id,leave_type_id,start_date,end_date,reason,status)
     values ($1,(select id from leave_types where code='nghi_benh'),current_date,current_date,'TEST routing','Chờ')
     returning id`, [itEmp]
  );
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: itEmp })]);
  const [{ submit_request: flowId }] = await q(`select submit_request('leave',$1)`, [reqId]);

  const recip = await q(
    `select u.email, d.name dept from notifications n
       join auth.users u on u.id=n.user_id
       left join profiles p on p.id=n.user_id
       left join departments d on d.id=p.department_id
      where n.payload->>'flow' = $1 order by u.email`, [flowId]
  );
  console.log(`\nĐơn IT (nv4) → người nhận thông báo (flow ${flowId}):`);
  for (const r of recip) console.log(`  ${r.email} | ${r.dept}`);

  const got = (id) => recip.some((r) => r.email === ({ [itHead]: "nv1@test.5sao.vn" }[id]));
  console.log("\nKết quả mong đợi: CHỈ IT head (nv1) nhận; KD/Marketing head KHÔNG nhận.");
  console.log("  IT head nhận:", recip.some((r) => r.email === "nv1@test.5sao.vn"));
  console.log("  Marketing head nhận:", recip.some((r) => r.email === "nv2@test.5sao.vn"));
  console.log("  KD head nhận:", recip.some((r) => r.email === "minh.ql@test.5sao.vn"));

  await client.query("rollback");
  console.log("\n(rolled back — không thay đổi dữ liệu)");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("LỖI:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
