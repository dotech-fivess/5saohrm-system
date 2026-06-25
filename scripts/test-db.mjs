// Bộ test tích hợp tầng DB cho 5Sao HRM (M1–M5).
// Chạy: PGHOST=... PGPASSWORD=... node scripts/test-db.mjs
import pg from "pg";

const c = new pg.Client({ ssl: { rejectUnauthorized: false } });
let pass = 0,
  fail = 0;
const fails = [];

function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    fails.push(name + (detail ? " — " + detail : ""));
    console.log("  ✗ " + name + (detail ? " — " + detail : ""));
  }
}
async function scalar(sql) {
  const r = await c.query(sql);
  return r.rows[0] ? Object.values(r.rows[0])[0] : null;
}
async function asUser(uid, fn) {
  await c.query("begin");
  await c.query("set local role authenticated");
  await c.query(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true)`);
  try {
    return await fn();
  } finally {
    await c.query("rollback");
  }
}
async function claim(uid) {
  await c.query(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true)`);
}
async function expectThrow(name, fn) {
  try {
    await fn();
    check(name, false, "không ném lỗi như kỳ vọng");
  } catch {
    check(name, true);
  }
}

await c.connect();
const id = {};
for (const [k, email] of [
  ["an", "nv4@test.5sao.vn"],     // NV thường, phòng IT
  ["lan", "nv5@test.5sao.vn"],    // NV thường, phòng Marketing
  ["duc", "nv6@test.5sao.vn"],    // NV thường, phòng Kinh doanh
  ["headIt", "nv1@test.5sao.vn"], // Trưởng phòng IT (nhân viên + chức vụ Trưởng phòng)
  ["ql", "minh.ql@test.5sao.vn"], // HR/BLD (quan_ly) — toàn công ty
  ["admin", "hr.admin@test.5sao.vn"],
]) {
  id[k] = await scalar(`select id from auth.users where email='${email}'`);
}

try {
  // ============ 1. ENGINE TÍNH CÔNG (biên) ============
  console.log("\n[1] Engine fn_compute_workday (mục D)");
  check("HC 360' = 1.0 (đủ ngày)", Number(await scalar("select fn_compute_workday('HC',360)")) === 1);
  check("HC 300' = 1.0 (biên ≥5h)", Number(await scalar("select fn_compute_workday('HC',300)")) === 1);
  check("HC 299' = 0.5 (nửa ngày)", Number(await scalar("select fn_compute_workday('HC',299)")) === 0.5);
  check("HC 60' = 0.5 (biên ≥1h)", Number(await scalar("select fn_compute_workday('HC',60)")) === 0.5);
  check("HC 59' = 0", Number(await scalar("select fn_compute_workday('HC',59)")) === 0);
  check("ON 360' = 0.5 (HC×½)", Number(await scalar("select fn_compute_workday('ON',360)")) === 0.5);
  check("ON 299' = 0.25", Number(await scalar("select fn_compute_workday('ON',299)")) === 0.25);
  check("ON 59' = 0", Number(await scalar("select fn_compute_workday('ON',59)")) === 0);
  check("TC120 60' = 1.2", Number(await scalar("select fn_compute_workday('TC120',60)")) === 1.2);
  check("TC150 120' = 3.0", Number(await scalar("select fn_compute_workday('TC150',120)")) === 3.0);

  // ============ 2. CHẤM CÔNG RPC ============
  console.log("\n[2] RPC check-in / check-out (bất biến qua hàm)");
  await asUser(id.an, async () => {
    const st = await scalar("select state from attendance_checkin('HC', 21.0, 105.8)");
    check("check-in tạo bản ghi 'missing_checkout'", st === "missing_checkout");
  });
  await asUser(id.an, async () => {
    // mô phỏng đã vào làm 6h trước (insert bản ghi mở) rồi check-out → đủ ngày
    await c.query(`insert into attendance_records (employee_id, work_type_id, work_date, check_in_at, checkin_status, state) values ('${id.an}', (select id from work_types where code='HC'), current_date, now() - interval '6 hours', 'Hợp lệ', 'missing_checkout')`);
    const wd = await scalar("select computed_workday from attendance_checkout(21.0,105.8)");
    check("check-out sau 6h → ngày công = 1.0 (HC đủ ngày)", Number(wd) === 1);
    const state2 = await scalar(`select state from attendance_records where employee_id='${id.an}' and check_out_at is not null order by check_out_at desc limit 1`);
    check("sau check-out state='complete'", state2 === "complete");
  });
  await expectThrow("check-in 2 lần liên tiếp bị chặn", () =>
    asUser(id.an, async () => {
      await c.query("select attendance_checkin('HC',21,105)");
      await c.query("select attendance_checkin('HC',21,105)"); // lần 2 phải lỗi
    })
  );
  await expectThrow("check-in loại công sai bị chặn", () =>
    asUser(id.an, () => c.query("select attendance_checkin('XX',21,105)"))
  );

  // ============ 3. QUY TRÌNH DUYỆT ============
  console.log("\n[3] Quy trình duyệt (nghỉ phép 1 cấp / bổ sung công 2 cấp)");
  // 3a. Nghỉ phép: An nộp → Minh (QL) duyệt = cấp cuối
  await asUser(id.an, async () => {
    const lt = await scalar("select id from leave_types where code='online'");
    const req = await scalar(`insert into leave_requests (employee_id, leave_type_id, start_date, end_date, reason, status) values ('${id.an}','${lt}', current_date+3, current_date+3, 'test online', 'Chờ') returning id`);
    const flow = await scalar(`select submit_request('leave','${req}')`);
    const nsteps = await scalar(`select count(*)::int from approval_steps where flow_id='${flow}'`);
    check("nghỉ phép tạo đúng 1 cấp duyệt", nsteps === 1);
    await claim(id.ql);
    await c.query(`select decide_request('${flow}','Duyệt', null)`);
    const status = await scalar(`select status from leave_requests where id='${req}'`);
    check("QL duyệt nghỉ phép → status='Duyệt' (cấp cuối)", status === "Duyệt");
  });
  // 3b. Bổ sung công: An nộp → QL duyệt (lên cấp 2) → Admin duyệt = cấp cuối
  await asUser(id.an, async () => {
    const adj = await scalar(`insert into attendance_adjustments (employee_id, kind, reason, status) values ('${id.an}','forgot_checkout','test', 'Chờ') returning id`);
    const flow = await scalar(`select submit_request('attendance_adjustment','${adj}')`);
    check("bổ sung công tạo đúng 2 cấp duyệt", Number(await scalar(`select count(*)::int from approval_steps where flow_id='${flow}'`)) === 2);
    await claim(id.ql);
    await c.query(`select decide_request('${flow}','Duyệt', null)`);
    check("QL duyệt cấp 1 → flow vẫn 'Chờ', lên cấp 2", (await scalar(`select status from approval_flows where id='${flow}'`)) === "Chờ" && Number(await scalar(`select current_level from approval_flows where id='${flow}'`)) === 2);
    await claim(id.admin);
    await c.query(`select decide_request('${flow}','Duyệt', null)`);
    check("Admin duyệt cấp cuối → adjustment 'Duyệt'", (await scalar(`select status from attendance_adjustments where id='${adj}'`)) === "Duyệt");
  });
  // 3c. Nhân viên KHÔNG được duyệt
  await expectThrow("nhân viên không có quyền duyệt", () =>
    asUser(id.an, async () => {
      const lt = await scalar("select id from leave_types where code='online'");
      const req = await scalar(`insert into leave_requests (employee_id, leave_type_id, start_date, end_date, reason, status) values ('${id.an}','${lt}', current_date+4, current_date+4, 'x', 'Chờ') returning id`);
      const flow = await scalar(`select submit_request('leave','${req}')`);
      await c.query(`select decide_request('${flow}','Duyệt', null)`); // An tự duyệt → phải lỗi
    })
  );

  // ============ 4. PHÂN QUYỀN (RLS) ============
  console.log("\n[4] RLS phân quyền theo vai trò");
  await asUser(id.an, async () => {
    check("Nhân viên chỉ thấy hồ sơ của mình", Number(await scalar("select count(*)::int from profiles")) === 1);
    check("Nhân viên chỉ thấy chấm công của mình", (await scalar(`select coalesce(bool_and(employee_id='${id.an}'), true) from attendance_records`)) === true);
  });
  // quan_ly = HR/BLD → xem TOÀN CÔNG TY (mọi phòng)
  await asUser(id.ql, async () => {
    check("HR/BLD (quản lý) thấy NV phòng IT (An)", (await scalar(`select coalesce(bool_or(id='${id.an}'),false) from profiles`)) === true);
    check("HR/BLD (quản lý) thấy NV phòng KD (Đức) — toàn công ty", (await scalar(`select coalesce(bool_or(id='${id.duc}'),false) from profiles`)) === true);
  });
  // Trưởng phòng (nhân viên + chức vụ) → chỉ thấy/duyệt phòng mình
  await asUser(id.headIt, async () => {
    check("Trưởng phòng IT thấy NV phòng mình (An-IT)", (await scalar(`select coalesce(bool_or(id='${id.an}'),false) from profiles`)) === true);
    check("Trưởng phòng IT KHÔNG thấy NV phòng khác (Đức-KD)", (await scalar(`select coalesce(bool_or(id='${id.duc}'),false) from profiles`)) === false);
    check(
      "Trưởng phòng IT chỉ thấy đơn nghỉ của phòng mình",
      (await scalar(
        `select coalesce(bool_and(e.department_id=(select department_id from profiles where id='${id.headIt}') or l.employee_id='${id.headIt}'), true) from leave_requests l join profiles e on e.id=l.employee_id`
      )) === true
    );
  });

  // ============ 5. BẤT BIẾN DỮ LIỆU ============
  console.log("\n[5] Tính bất biến chấm công & audit");
  await expectThrow("UPDATE attendance_records bị chặn (insert-only)", () =>
    asUser(id.an, () => c.query(`update attendance_records set checkin_status='X' where employee_id='${id.an}'`))
  );
  await expectThrow("DELETE attendance_records bị chặn", () =>
    asUser(id.an, () => c.query(`delete from attendance_records where employee_id='${id.an}'`))
  );

  // ============ 6. RÀNG BUỘC DỮ LIỆU ============
  console.log("\n[6] Ràng buộc nghiệp vụ trên schema");
  check("work_type coefficient đúng cấu hình", (await scalar("select coefficient from work_types where code='TC150'")) == 1.5);
  check("mã NV tự sinh dạng NV-xxxx", /^NV-\d{4,}$/.test(await scalar(`select employee_code from profiles where id='${id.an}'`)));
  check("config có đủ tham số (8)", Number(await scalar("select count(*)::int from config_parameters")) === 8);
} catch (e) {
  console.error("\nLỖI HARNESS:", e.message);
  fail++;
  fails.push("harness crash: " + e.message);
  try { await c.query("rollback"); } catch {}
} finally {
  console.log(`\n================ KẾT QUẢ: ${pass} PASS / ${fail} FAIL ================`);
  if (fails.length) console.log("FAIL:\n - " + fails.join("\n - "));
  await c.end();
  process.exitCode = fail ? 1 : 0;
}
