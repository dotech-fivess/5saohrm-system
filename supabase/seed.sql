-- =====================================================================
-- 5Sao HRM — Seed dữ liệu nền (idempotent). Chạy sau migrations.
-- =====================================================================

-- ---------- Tham số cấu hình (mục C) ----------
insert into config_parameters (key, value, description) values
  ('hc_full_threshold_min', '300', 'HC: O−I ≥ 5h ⇒ 8/8'),
  ('hc_half_threshold_min', '60',  'HC: O−I ≥ 1h ⇒ 4/8'),
  ('late_early_max_min',    '180', 'Đi trễ/về sớm tối đa 3h'),
  ('coef_tc120',            '1.2', 'Hệ số tăng ca 120'),
  ('coef_tc150',            '1.5', 'Hệ số tăng ca 150'),
  ('coef_online',           '0.5', 'Hệ số online = HC × 1/2'),
  ('standard_workday',      '8',   'Ngày công chuẩn 8/8'),
  ('rounding',              '"minute"', 'Làm tròn theo phút')
on conflict (key) do update set value = excluded.value, description = excluded.description;

-- ---------- Loại công (work_types) ----------
insert into work_types (code, name, coefficient) values
  ('HC',    'Hành chính', 1.0),
  ('TC120', 'Tăng ca 120', 1.2),
  ('TC150', 'Tăng ca 150', 1.5),
  ('ON',    'Online', 0.5)
on conflict (code) do update set name = excluded.name, coefficient = excluded.coefficient;

-- ---------- Loại nghỉ phép (leave_types) ----------
insert into leave_types (code, name, requires_attachment, max_hours, is_half_day) values
  ('khong_luong', 'Nghỉ không lương', false, null,  false),
  ('nua_ngay',    'Nghỉ nửa ngày',    false, null,  true),
  ('nghi_benh',   'Nghỉ bệnh',        true,  null,  false),
  ('di_tre',      'Đi trễ',           false, 3,     false),
  ('ve_som',      'Về sớm',           false, 3,     false),
  ('online',      'Làm online',       false, null,  false)
on conflict (code) do update set
  name = excluded.name,
  requires_attachment = excluded.requires_attachment,
  max_hours = excluded.max_hours,
  is_half_day = excluded.is_half_day;

-- ---------- Danh mục mẫu (theo design) ----------
insert into departments (name) values ('Marketing'), ('IT'), ('Kinh doanh')
  on conflict (name) do nothing;
-- Vị trí theo phòng ban (mỗi phòng ban có danh sách vị trí riêng)
insert into positions (name, department_id)
select v.name, d.id from (values
  ('Content','Marketing'), ('Designer','Marketing'), ('SEO','Marketing'),
  ('Dev','IT'), ('Tester','IT'), ('DevOps','IT'),
  ('Sale','Kinh doanh'), ('Account','Kinh doanh'), ('Telesale','Kinh doanh')
) as v(name, dept)
join departments d on d.name = v.dept
where not exists (select 1 from positions p where p.department_id = d.id and p.name = v.name);

insert into titles (name) values ('Trưởng phòng'), ('Nhân viên')
  on conflict (name) do nothing;

insert into shifts (name, start_time, end_time)
select v.name, v.s::time, v.e::time from (values
  ('Hành chính', '08:00', '17:00'),
  ('Ca chiều',   '13:00', '21:00')
) as v(name, s, e)
where not exists (select 1 from shifts x where x.name = v.name);

insert into locations (name, province, address, work_start, work_end, lunch_start, lunch_end)
select v.name, v.province, v.address, v.ws::time, v.we::time, v.ls::time, v.le::time from (values
  ('Trụ sở Hà Nội', 'Hà Nội', 'Hà Nội', '08:00', '17:00', '12:00', '13:00'),
  ('HCM · CN1',     'TP.HCM',  'TP. Hồ Chí Minh', '13:00', '21:00', '17:30', '18:00'),
  ('Đà Nẵng',       'Đà Nẵng', 'Đà Nẵng', '08:00', '17:00', '12:00', '13:00')
) as v(name, province, address, ws, we, ls, le)
where not exists (select 1 from locations x where x.name = v.name);

-- ---------- Ghi chú tạo người dùng quản trị đầu tiên ----------
-- 1) Tạo user trong Supabase: Authentication → Users → Add user (email + password),
--    hoặc đăng ký qua trang /login (trigger sẽ tự tạo profiles, role mặc định 'nhan_vien').
-- 2) Nâng quyền quản trị:
--    update profiles set role = 'qt_sua', full_name = 'Phạm Hà'
--    where email_company = 'admin@5sao.vn';
