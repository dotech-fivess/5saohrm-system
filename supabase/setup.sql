-- 5Sao HRM — SETUP TỔNG HỢP (idempotent)

-- =====================================================================
-- 5Sao HRM — M0 schema
-- Bảng, sequence, trigger, hàm tính công. Chạy trước 0002_rls.sql.
-- =====================================================================

-- ---------- Danh mục ----------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists titles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text,
  address text,
  work_start time,
  work_end time,
  lunch_start time,
  lunch_end time,
  created_at timestamptz not null default now()
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now()
);

create table if not exists location_shifts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  unique (location_id, shift_id)
);

-- Loại công (hệ số) — KHÁC với shift (khung giờ)
create table if not exists work_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('HC','TC120','TC150','ON')),
  name text not null,
  coefficient numeric not null default 1,
  created_at timestamptz not null default now()
);

-- ---------- Hồ sơ nhân viên ----------
create sequence if not exists employee_code_seq start 1;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code text not null unique
    default ('NV-' || lpad(nextval('employee_code_seq')::text, 4, '0')),
  full_name text not null default '',
  avatar_url text,
  email_company text,
  phone text,
  gender text check (gender in ('Nam','Nữ','Khác')),
  dob date,
  address text,
  department_id uuid references departments(id),
  position_id uuid references positions(id),
  title_id uuid references titles(id),
  join_date date,
  probation_date date,
  official_date date,
  contract_type text check (contract_type in ('TTS','Thử việc','Chính thức')),
  work_status text not null default 'Đang làm'
    check (work_status in ('Đang làm','Nghỉ việc','Tạm nghỉ')),
  role text not null default 'nhan_vien'
    check (role in ('qt_sua','qt_xem','quan_ly','nhan_vien')),
  account_status text not null default 'Hoạt động'
    check (account_status in ('Hoạt động','Khóa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employee_locations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  location_id uuid not null references locations(id),
  shift_id uuid references shifts(id),
  created_at timestamptz not null default now(),
  unique (employee_id, location_id, shift_id)
);

-- ---------- Quy trình duyệt ----------
create table if not exists approval_flows (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('attendance_adjustment','leave')),
  employee_id uuid not null references profiles(id),
  ref_id uuid,
  current_level int not null default 1,
  status text not null default 'Chờ' check (status in ('Chờ','Duyệt','Từ chối')),
  created_at timestamptz not null default now()
);

create table if not exists approval_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references approval_flows(id) on delete cascade,
  level int not null,
  approver_role text not null,
  decision text not null default 'Chờ' check (decision in ('Chờ','Duyệt','Từ chối')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  reason text
);

-- ---------- Chấm công (INSERT-ONLY) ----------
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id),
  location_id uuid references locations(id),
  work_type_id uuid references work_types(id),
  work_date date not null default current_date,
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  checkin_status text check (checkin_status in ('Hợp lệ','Trễ')),
  checkout_status text check (checkout_status in ('Hợp lệ','Sớm','Quên')),
  computed_workday numeric not null default 0,
  state text not null default 'missing_checkout'
    check (state in ('complete','missing_checkout')),
  created_at timestamptz not null default now()
);
create index if not exists idx_att_emp_date on attendance_records (employee_id, work_date);

create table if not exists attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id),
  kind text not null check (kind in ('forgot_checkin','forgot_checkout','wrong_record')),
  target_record_id uuid references attendance_records(id),
  payload jsonb,
  reason text not null,
  status text not null default 'Chờ' check (status in ('Chờ','Duyệt','Từ chối')),
  approval_flow_id uuid references approval_flows(id),
  created_at timestamptz not null default now()
);

-- ---------- Nghỉ phép ----------
create table if not exists leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  requires_attachment boolean not null default false,
  max_hours numeric,
  is_half_day boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id),
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  hours numeric,
  reason text not null,
  attachment_url text,
  status text not null default 'Chờ' check (status in ('Chờ','Duyệt','Không duyệt')),
  approval_flow_id uuid references approval_flows(id),
  workday_impact numeric,
  created_at timestamptz not null default now()
);

create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  year int not null,
  accrued numeric not null default 0,
  used numeric not null default 0,
  remaining numeric not null default 0,
  unique (employee_id, year)
);

-- ---------- Cấu hình / thông báo / audit ----------
create table if not exists config_parameters (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text,
  title text,
  body text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  entity text not null,
  entity_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Trigger & hàm
-- =====================================================================

-- updated_at tự cập nhật
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Tạo profiles khi có user Auth mới (chạy quyền definer để bỏ qua RLS)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email_company, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Đọc tham số cấu hình kiểu số
create or replace function fn_config_num(p_key text)
returns numeric language sql stable as $$
  select (value #>> '{}')::numeric from config_parameters where key = p_key;
$$;

-- Engine tính công (mục D). Đơn vị: HC/ON trả về NGÀY CÔNG (1.0 = 8/8);
-- TC120/TC150 trả về GIỜ QUY ĐỔI. Đọc ngưỡng & hệ số từ config_parameters.
create or replace function fn_compute_workday(p_code text, p_minutes int)
returns numeric language plpgsql stable as $$
declare
  full_thr numeric := fn_config_num('hc_full_threshold_min'); -- 300
  half_thr numeric := fn_config_num('hc_half_threshold_min'); -- 60
  res numeric := 0;
begin
  if p_code = 'HC' then
    if p_minutes >= full_thr then res := 1.0;
    elsif p_minutes >= half_thr then res := 0.5;
    else res := 0; end if;
  elsif p_code = 'ON' then
    if p_minutes >= full_thr then res := 1.0 * fn_config_num('coef_online');
    elsif p_minutes >= half_thr then res := 0.5 * fn_config_num('coef_online');
    else res := 0; end if;
  elsif p_code = 'TC120' then
    res := (p_minutes::numeric / 60) * fn_config_num('coef_tc120');
  elsif p_code = 'TC150' then
    res := (p_minutes::numeric / 60) * fn_config_num('coef_tc150');
  else
    res := 0;
  end if;
  return round(res, 2);
end;
$$;


-- =====================================================================
-- 5Sao HRM — M0 Row Level Security (IDEMPOTENT — chạy lại được nhiều lần)
-- Chạy SAU 0001_schema.sql.
-- =====================================================================

-- ---------- Hàm hỗ trợ phân quyền (security definer để tránh đệ quy RLS) ----------
create or replace function auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_qt_sua()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'qt_sua', false);
$$;

create or replace function is_admin_any()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('qt_sua','qt_xem'), false);
$$;

create or replace function is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'quan_ly', false);
$$;

create or replace function my_department()
returns uuid language sql stable security definer set search_path = public as $$
  select department_id from profiles where id = auth.uid();
$$;

create or replace function in_my_scope(p_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_employee and p.department_id = my_department()
  );
$$;

-- ---------- Bật RLS ----------
alter table profiles               enable row level security;
alter table departments            enable row level security;
alter table positions              enable row level security;
alter table titles                 enable row level security;
alter table locations              enable row level security;
alter table shifts                 enable row level security;
alter table location_shifts        enable row level security;
alter table work_types             enable row level security;
alter table employee_locations     enable row level security;
alter table attendance_records     enable row level security;
alter table attendance_adjustments enable row level security;
alter table leave_types            enable row level security;
alter table leave_requests         enable row level security;
alter table leave_balances         enable row level security;
alter table approval_flows         enable row level security;
alter table approval_steps         enable row level security;
alter table config_parameters      enable row level security;
alter table notifications          enable row level security;
alter table audit_logs             enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = auth.uid() or is_admin_any() or (is_manager() and department_id = my_department())
);
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for all
  using (is_qt_sua()) with check (is_qt_sua());

-- ---------- Danh mục (đọc: mọi user đã đăng nhập; ghi: qt_sua) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'departments','positions','titles','locations','shifts',
    'location_shifts','work_types','leave_types','config_parameters'
  ] loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format('create policy %1$s_select on %1$s for select using (auth.uid() is not null);', t);
    execute format('drop policy if exists %1$s_write on %1$s;', t);
    execute format('create policy %1$s_write on %1$s for all using (is_qt_sua()) with check (is_qt_sua());', t);
  end loop;
end $$;

-- ---------- employee_locations ----------
drop policy if exists emploc_select on employee_locations;
create policy emploc_select on employee_locations for select using (
  employee_id = auth.uid() or is_admin_any() or (is_manager() and in_my_scope(employee_id))
);
drop policy if exists emploc_write on employee_locations;
create policy emploc_write on employee_locations for all
  using (is_qt_sua()) with check (is_qt_sua());

-- ---------- attendance_records (INSERT-ONLY) ----------
drop policy if exists att_select on attendance_records;
create policy att_select on attendance_records for select using (
  employee_id = auth.uid() or is_admin_any() or (is_manager() and in_my_scope(employee_id))
);
drop policy if exists att_insert on attendance_records;
create policy att_insert on attendance_records for insert with check (
  employee_id = auth.uid() or is_qt_sua()
);
revoke update, delete on attendance_records from anon, authenticated;

-- ---------- attendance_adjustments ----------
drop policy if exists adj_select on attendance_adjustments;
create policy adj_select on attendance_adjustments for select using (
  employee_id = auth.uid() or is_admin_any() or (is_manager() and in_my_scope(employee_id))
);
drop policy if exists adj_insert on attendance_adjustments;
create policy adj_insert on attendance_adjustments for insert with check (
  employee_id = auth.uid()
);
drop policy if exists adj_update on attendance_adjustments;
create policy adj_update on attendance_adjustments for update
  using (is_admin_any() or (is_manager() and in_my_scope(employee_id)));

-- ---------- leave_requests ----------
drop policy if exists leave_select on leave_requests;
create policy leave_select on leave_requests for select using (
  employee_id = auth.uid() or is_admin_any() or (is_manager() and in_my_scope(employee_id))
);
drop policy if exists leave_insert on leave_requests;
create policy leave_insert on leave_requests for insert with check (
  employee_id = auth.uid()
);
drop policy if exists leave_update on leave_requests;
create policy leave_update on leave_requests for update
  using (is_admin_any() or (is_manager() and in_my_scope(employee_id)));

-- ---------- leave_balances ----------
drop policy if exists bal_select on leave_balances;
create policy bal_select on leave_balances for select using (
  employee_id = auth.uid() or is_admin_any() or (is_manager() and in_my_scope(employee_id))
);
drop policy if exists bal_write on leave_balances;
create policy bal_write on leave_balances for all
  using (is_qt_sua()) with check (is_qt_sua());

-- ---------- approval_flows / approval_steps ----------
drop policy if exists flow_select on approval_flows;
create policy flow_select on approval_flows for select using (
  employee_id = auth.uid() or is_admin_any() or is_manager()
);
drop policy if exists flow_write on approval_flows;
create policy flow_write on approval_flows for all
  using (is_admin_any() or is_manager()) with check (is_admin_any() or is_manager());

drop policy if exists step_select on approval_steps;
create policy step_select on approval_steps for select using (
  is_admin_any() or is_manager()
  or exists (select 1 from approval_flows f where f.id = flow_id and f.employee_id = auth.uid())
);
drop policy if exists step_write on approval_steps;
create policy step_write on approval_steps for all
  using (is_admin_any() or is_manager()) with check (is_admin_any() or is_manager());

-- ---------- notifications (của chính mình) ----------
drop policy if exists noti_select on notifications;
create policy noti_select on notifications for select using (user_id = auth.uid());
drop policy if exists noti_update on notifications;
create policy noti_update on notifications for update using (user_id = auth.uid());
drop policy if exists noti_insert on notifications;
create policy noti_insert on notifications for insert with check (auth.uid() is not null);

-- ---------- audit_logs (đọc: admin; ghi: insert-only) ----------
drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select using (is_admin_any());
drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert with check (actor_id = auth.uid());
revoke update, delete on audit_logs from anon, authenticated;


-- =====================================================================
-- 5Sao HRM — Storage bucket cho file hồ sơ (S7)
-- Chạy sau 0002_rls.sql.
-- =====================================================================

-- Bucket 'ho-so' (private)
insert into storage.buckets (id, name, public)
values ('ho-so', 'ho-so', false)
on conflict (id) do nothing;

-- RLS cho object trong bucket 'ho-so' (MVP: cho user đã đăng nhập đọc/ghi;
-- siết theo chủ sở hữu/scope sẽ làm ở giai đoạn sau).
drop policy if exists hoso_read on storage.objects;
create policy hoso_read on storage.objects for select
  using (bucket_id = 'ho-so' and auth.uid() is not null);

drop policy if exists hoso_insert on storage.objects;
create policy hoso_insert on storage.objects for insert
  with check (bucket_id = 'ho-so' and auth.uid() is not null);

drop policy if exists hoso_update on storage.objects;
create policy hoso_update on storage.objects for update
  using (bucket_id = 'ho-so' and auth.uid() is not null);


-- =====================================================================
-- 5Sao HRM — M2 Chấm công: RPC check-in / check-out
-- Bảng attendance_records bất biến với client (revoke update/delete).
-- Việc ghi nhận làm qua hàm SECURITY DEFINER có kiểm soát + đấu nối engine.
-- Chạy sau 0003_storage.sql. Idempotent.
-- =====================================================================

-- Check-in: tạo bản ghi mở cho hôm nay
create or replace function attendance_checkin(
  p_work_type text,
  p_lat double precision,
  p_lng double precision
) returns attendance_records
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_wt uuid;
  v_rec attendance_records;
  v_shift_start time;
  v_status text := 'Hợp lệ';
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  select id into v_wt from work_types where code = p_work_type;
  if v_wt is null then raise exception 'Loại công không hợp lệ: %', p_work_type; end if;

  if exists (
    select 1 from attendance_records
    where employee_id = v_uid and check_out_at is null and work_date = current_date
  ) then
    raise exception 'Bạn đang có ca chưa check-out hôm nay';
  end if;

  -- Ca sớm nhất được gán (nếu có) để xác định Trễ
  select s.start_time into v_shift_start
  from employee_locations el
  join shifts s on s.id = el.shift_id
  where el.employee_id = v_uid
  order by s.start_time limit 1;

  if v_shift_start is not null
     and (now() at time zone 'Asia/Ho_Chi_Minh')::time > v_shift_start then
    v_status := 'Trễ';
  end if;

  insert into attendance_records (
    employee_id, work_type_id, work_date, check_in_at, check_in_lat, check_in_lng,
    checkin_status, state
  ) values (
    v_uid, v_wt, current_date, now(), p_lat, p_lng, v_status, 'missing_checkout'
  ) returning * into v_rec;

  return v_rec;
end; $$;

-- Check-out: hoàn tất bản ghi mở gần nhất + tính ngày công
create or replace function attendance_checkout(
  p_lat double precision,
  p_lng double precision
) returns attendance_records
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rec attendance_records;
  v_minutes int;
  v_code text;
  v_wd numeric;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;

  select * into v_rec from attendance_records
  where employee_id = v_uid and state = 'missing_checkout' and check_out_at is null
  order by check_in_at desc limit 1;

  if v_rec.id is null then raise exception 'Không có ca check-in đang mở'; end if;

  v_minutes := floor(extract(epoch from (now() - v_rec.check_in_at)) / 60);
  select code into v_code from work_types where id = v_rec.work_type_id;
  v_wd := fn_compute_workday(v_code, v_minutes);

  update attendance_records set
    check_out_at = now(), check_out_lat = p_lat, check_out_lng = p_lng,
    checkout_status = 'Hợp lệ', computed_workday = v_wd, state = 'complete'
  where id = v_rec.id
  returning * into v_rec;

  return v_rec;
end; $$;

grant execute on function attendance_checkin(text, double precision, double precision) to authenticated;
grant execute on function attendance_checkout(double precision, double precision) to authenticated;


-- =====================================================================
-- 5Sao HRM — M2/M3 Quy trình duyệt (state machine, số cấp theo loại)
--   attendance_adjustment: 2 cấp (quan_ly → qt_sua)
--   leave: 1 cấp (quan_ly là cấp cuối)
-- Chạy sau 0004_attendance.sql. Idempotent.
-- =====================================================================

-- Áp dụng hiệu lực khi yêu cầu kết thúc (Duyệt/Từ chối)
create or replace function finalize_request(p_type text, p_ref uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_adj attendance_adjustments;
  v_rec attendance_records;
  v_minutes int; v_code text; v_wd numeric;
begin
  if p_type = 'leave' then
    update leave_requests
      set status = case when p_result = 'Duyệt' then 'Duyệt' else 'Không duyệt' end
      where id = p_ref;
    return;
  elsif p_type = 'attendance_adjustment' then
    update attendance_adjustments
      set status = case when p_result = 'Duyệt' then 'Duyệt' else 'Từ chối' end
      where id = p_ref;

    if p_result = 'Duyệt' then
      select * into v_adj from attendance_adjustments where id = p_ref;
      -- Quên check-out: gán O từ payload, tính lại ngày công
      if v_adj.kind = 'forgot_checkout' and v_adj.target_record_id is not null
         and (v_adj.payload ? 'check_out_at') then
        select * into v_rec from attendance_records where id = v_adj.target_record_id;
        if v_rec.id is not null then
          v_minutes := floor(extract(epoch from
            ((v_adj.payload->>'check_out_at')::timestamptz - v_rec.check_in_at)) / 60);
          select code into v_code from work_types where id = v_rec.work_type_id;
          v_wd := fn_compute_workday(v_code, v_minutes);
          update attendance_records set
            check_out_at = (v_adj.payload->>'check_out_at')::timestamptz,
            checkout_status = 'Hợp lệ', computed_workday = v_wd, state = 'complete'
          where id = v_rec.id;
        end if;
      end if;
    end if;
    return;
  end if;
end; $$;

-- Nộp yêu cầu: tạo flow + các bước duyệt theo loại
create or replace function submit_request(p_type text, p_ref uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_flow uuid;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  insert into approval_flows (request_type, employee_id, ref_id, current_level, status)
  values (p_type, v_uid, p_ref, 1, 'Chờ') returning id into v_flow;

  if p_type = 'attendance_adjustment' then
    insert into approval_steps (flow_id, level, approver_role)
    values (v_flow, 1, 'quan_ly'), (v_flow, 2, 'qt_sua');
    update attendance_adjustments set approval_flow_id = v_flow where id = p_ref;
  elsif p_type = 'leave' then
    insert into approval_steps (flow_id, level, approver_role)
    values (v_flow, 1, 'quan_ly');
    update leave_requests set approval_flow_id = v_flow where id = p_ref;
  else
    raise exception 'Loại yêu cầu không hợp lệ: %', p_type;
  end if;

  return v_flow;
end; $$;

-- Duyệt / Từ chối ở cấp hiện tại
create or replace function decide_request(p_flow uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_role text := auth_role();
  v_flow approval_flows; v_step approval_steps; v_max int;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  if p_decision not in ('Duyệt','Từ chối') then raise exception 'Quyết định không hợp lệ'; end if;

  select * into v_flow from approval_flows where id = p_flow;
  if v_flow.id is null then raise exception 'Không tìm thấy yêu cầu'; end if;
  if v_flow.status <> 'Chờ' then raise exception 'Yêu cầu đã được xử lý'; end if;

  select * into v_step from approval_steps where flow_id = p_flow and level = v_flow.current_level;
  if v_role <> v_step.approver_role and v_role <> 'qt_sua' then
    raise exception 'Bạn không có quyền duyệt cấp này';
  end if;

  update approval_steps set
    decision = p_decision, decided_by = v_uid, decided_at = now(), reason = p_reason
  where id = v_step.id;

  if p_decision = 'Từ chối' then
    update approval_flows set status = 'Từ chối' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Từ chối');
    return;
  end if;

  select max(level) into v_max from approval_steps where flow_id = p_flow;
  if v_flow.current_level >= v_max then
    update approval_flows set status = 'Duyệt' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Duyệt');
  else
    update approval_flows set current_level = current_level + 1 where id = p_flow;
  end if;
end; $$;

grant execute on function submit_request(text, uuid) to authenticated;
grant execute on function decide_request(uuid, text, text) to authenticated;


-- =====================================================================
-- 5Sao HRM — M5 Thông báo in-app
-- Cập nhật submit_request & decide_request để bắn notifications.
-- Chạy sau 0005_approval.sql. Idempotent (create or replace).
-- =====================================================================

-- Bắn thông báo cho tất cả user đang hoạt động có vai trò chỉ định
create or replace function notify_role(p_role text, p_title text, p_body text, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, payload)
  select id, 'approval', p_title, p_body, p_payload
  from profiles where role = p_role and account_status = 'Hoạt động';
$$;

create or replace function notify_user(p_user uuid, p_title text, p_body text, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, payload)
  values (p_user, 'approval', p_title, p_body, p_payload);
$$;

-- Nộp yêu cầu + thông báo cấp duyệt 1
create or replace function submit_request(p_type text, p_ref uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_flow uuid; v_name text;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  select full_name into v_name from profiles where id = v_uid;

  insert into approval_flows (request_type, employee_id, ref_id, current_level, status)
  values (p_type, v_uid, p_ref, 1, 'Chờ') returning id into v_flow;

  if p_type = 'attendance_adjustment' then
    insert into approval_steps (flow_id, level, approver_role)
    values (v_flow, 1, 'quan_ly'), (v_flow, 2, 'qt_sua');
    update attendance_adjustments set approval_flow_id = v_flow where id = p_ref;
  elsif p_type = 'leave' then
    insert into approval_steps (flow_id, level, approver_role)
    values (v_flow, 1, 'quan_ly');
    update leave_requests set approval_flow_id = v_flow where id = p_ref;
  else
    raise exception 'Loại yêu cầu không hợp lệ: %', p_type;
  end if;

  perform notify_role('quan_ly', 'Có yêu cầu chờ duyệt',
    coalesce(v_name,'Nhân viên') || ' gửi một yêu cầu cần duyệt.',
    jsonb_build_object('flow', v_flow, 'type', p_type));
  return v_flow;
end; $$;

-- Duyệt/Từ chối + thông báo
create or replace function decide_request(p_flow uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_role text := auth_role();
  v_flow approval_flows; v_step approval_steps; v_max int; v_next_role text;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  if p_decision not in ('Duyệt','Từ chối') then raise exception 'Quyết định không hợp lệ'; end if;

  select * into v_flow from approval_flows where id = p_flow;
  if v_flow.id is null then raise exception 'Không tìm thấy yêu cầu'; end if;
  if v_flow.status <> 'Chờ' then raise exception 'Yêu cầu đã được xử lý'; end if;

  select * into v_step from approval_steps where flow_id = p_flow and level = v_flow.current_level;
  if v_role <> v_step.approver_role and v_role <> 'qt_sua' then
    raise exception 'Bạn không có quyền duyệt cấp này';
  end if;

  update approval_steps set decision = p_decision, decided_by = v_uid, decided_at = now(), reason = p_reason
  where id = v_step.id;

  if p_decision = 'Từ chối' then
    update approval_flows set status = 'Từ chối' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Từ chối');
    perform notify_user(v_flow.employee_id, 'Yêu cầu bị từ chối',
      coalesce(p_reason, 'Yêu cầu của bạn đã bị từ chối.'),
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
    return;
  end if;

  select max(level) into v_max from approval_steps where flow_id = p_flow;
  if v_flow.current_level >= v_max then
    update approval_flows set status = 'Duyệt' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Duyệt');
    perform notify_user(v_flow.employee_id, 'Yêu cầu đã được duyệt',
      'Yêu cầu của bạn đã được duyệt ở cấp cuối.',
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
  else
    update approval_flows set current_level = current_level + 1 where id = p_flow;
    select approver_role into v_next_role from approval_steps where flow_id = p_flow and level = v_flow.current_level + 1;
    perform notify_role(v_next_role, 'Có yêu cầu chờ duyệt (cấp tiếp theo)',
      'Một yêu cầu đã qua cấp 1, chờ bạn duyệt cấp cuối.',
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
  end if;
end; $$;

grant execute on function submit_request(text, uuid) to authenticated;
grant execute on function decide_request(uuid, text, text) to authenticated;


-- =====================================================================
-- 5Sao HRM — M1 hoàn thiện: bảng metadata file hồ sơ (S7)
-- 1 dòng / (nhân viên × loại tài liệu); thay thế = cập nhật dòng + tăng version.
-- Chạy sau 0006. Idempotent.
-- =====================================================================

create table if not exists employee_files (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  doc_type text not null check (doc_type in ('CCCD','Hợp đồng','CV','Cam kết')),
  storage_path text not null,
  file_name text,
  size bigint,
  version int not null default 1,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, doc_type)
);

alter table employee_files enable row level security;

drop policy if exists empfile_select on employee_files;
create policy empfile_select on employee_files for select using (
  employee_id = auth.uid() or is_admin_any() or (is_manager() and in_my_scope(employee_id))
);
drop policy if exists empfile_write on employee_files;
create policy empfile_write on employee_files for all
  using (is_qt_sua()) with check (is_qt_sua());

-- Cho phép xoá object trong bucket 'ho-so' (0003 chưa có policy delete)
drop policy if exists hoso_delete on storage.objects;
create policy hoso_delete on storage.objects for delete
  using (bucket_id = 'ho-so' and auth.uid() is not null);


-- =====================================================================
-- 5Sao HRM — Cho phép CHECK-OUT NHIỀU LẦN trong ngày
-- Giờ check-out ghi nhận = LẦN BẤM CUỐI CÙNG (cập nhật + tính lại ngày công).
-- Ưu tiên ca đang mở; nếu không có ca mở, cập nhật ca gần nhất hôm nay.
-- Chạy sau 0007. Idempotent (create or replace).
-- =====================================================================

create or replace function attendance_checkout(
  p_lat double precision,
  p_lng double precision
) returns attendance_records
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rec attendance_records;
  v_minutes int;
  v_code text;
  v_wd numeric;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;

  -- Lấy ca hôm nay có check-in: ưu tiên ca CHƯA check-out, nếu không thì ca gần nhất
  select * into v_rec from attendance_records
  where employee_id = v_uid
    and work_date = current_date
    and check_in_at is not null
  order by (check_out_at is null) desc, check_in_at desc
  limit 1;

  if v_rec.id is null then
    raise exception 'Hôm nay bạn chưa check-in';
  end if;

  -- Cập nhật giờ ra = thời điểm hiện tại (lần bấm cuối cùng)
  v_minutes := floor(extract(epoch from (now() - v_rec.check_in_at)) / 60);
  select code into v_code from work_types where id = v_rec.work_type_id;
  v_wd := fn_compute_workday(v_code, v_minutes);

  update attendance_records set
    check_out_at = now(), check_out_lat = p_lat, check_out_lng = p_lng,
    checkout_status = 'Hợp lệ', computed_workday = v_wd, state = 'complete'
  where id = v_rec.id
  returning * into v_rec;

  return v_rec;
end; $$;

grant execute on function attendance_checkout(double precision, double precision) to authenticated;


-- =====================================================================
-- 5Sao HRM — Vị trí thuộc theo Phòng ban
-- Mỗi phòng ban có danh sách vị trí riêng. Cho phép trùng tên vị trí
-- ở các phòng ban khác nhau (unique theo (department_id, name)).
-- Chạy sau 0008. Idempotent.
-- =====================================================================

alter table positions add column if not exists department_id uuid references departments(id) on delete cascade;

-- Gán phòng ban cho các vị trí cũ (theo tên quen thuộc) nếu còn null
update positions set department_id = (select id from departments where name='Marketing')
  where lower(name) = 'content' and department_id is null;
update positions set department_id = (select id from departments where name='IT')
  where lower(name) = 'dev' and department_id is null;
update positions set department_id = (select id from departments where name='Kinh doanh')
  where lower(name) = 'sale' and department_id is null;

-- Bỏ unique(name) cũ, thêm unique theo (phòng ban, tên)
alter table positions drop constraint if exists positions_name_key;
create unique index if not exists positions_dept_name_uniq on positions (department_id, name);


-- =====================================================================
-- 5Sao HRM — Định tuyến yêu cầu (nghỉ phép / bổ sung công) về TRƯỞNG PHÒNG
-- của ĐÚNG phòng ban người gửi, thay vì báo cho mọi quản lý.
--   Trưởng phòng = nhân sự cùng phòng ban, role='quan_ly' HOẶC chức vụ 'Trưởng phòng'.
--   Nếu phòng chưa có trưởng phòng → fallback báo cho quản trị (qt_sua).
--   Quản lý chỉ được DUYỆT yêu cầu của nhân sự cùng phòng ban.
-- Chạy sau 0009. Idempotent.
-- =====================================================================

-- Thông báo cho trưởng phòng của một phòng ban (trừ chính người gửi). Trả về số người nhận.
create or replace function notify_dept_heads(p_dept uuid, p_exclude uuid, p_title text, p_body text, p_payload jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_cnt int;
begin
  insert into notifications (user_id, type, title, body, payload)
  select p.id, 'approval', p_title, p_body, p_payload
  from profiles p
  where p.account_status = 'Hoạt động'
    and p.department_id = p_dept
    and p.id <> coalesce(p_exclude, '00000000-0000-0000-0000-000000000000'::uuid)
    and (p.role = 'quan_ly'
         or p.title_id in (select id from titles where lower(name) = lower('Trưởng phòng')));
  get diagnostics v_cnt = row_count;
  return coalesce(v_cnt, 0);
end; $$;

-- Nộp yêu cầu: route thông báo về trưởng phòng phòng ban người gửi (fallback: quản trị)
create or replace function submit_request(p_type text, p_ref uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_flow uuid; v_name text;
  v_dept uuid; v_deptname text; v_cnt int; v_body text;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  select full_name, department_id into v_name, v_dept from profiles where id = v_uid;
  select name into v_deptname from departments where id = v_dept;

  insert into approval_flows (request_type, employee_id, ref_id, current_level, status)
  values (p_type, v_uid, p_ref, 1, 'Chờ') returning id into v_flow;

  if p_type = 'attendance_adjustment' then
    insert into approval_steps (flow_id, level, approver_role)
    values (v_flow, 1, 'quan_ly'), (v_flow, 2, 'qt_sua');
    update attendance_adjustments set approval_flow_id = v_flow where id = p_ref;
    v_body := coalesce(v_name,'Nhân viên') || ' (phòng ' || coalesce(v_deptname,'—') || ') gửi yêu cầu bổ sung công.';
  elsif p_type = 'leave' then
    insert into approval_steps (flow_id, level, approver_role)
    values (v_flow, 1, 'quan_ly');
    update leave_requests set approval_flow_id = v_flow where id = p_ref;
    v_body := coalesce(v_name,'Nhân viên') || ' (phòng ' || coalesce(v_deptname,'—') || ') gửi đơn nghỉ phép.';
  else
    raise exception 'Loại yêu cầu không hợp lệ: %', p_type;
  end if;

  -- Báo cho trưởng phòng đúng phòng ban; nếu phòng chưa có trưởng phòng → báo quản trị
  v_cnt := notify_dept_heads(v_dept, v_uid, 'Có yêu cầu chờ duyệt', v_body,
    jsonb_build_object('flow', v_flow, 'type', p_type, 'department', v_dept));
  if v_cnt = 0 then
    perform notify_role('qt_sua', 'Có yêu cầu chờ duyệt (phòng chưa có trưởng phòng)',
      v_body, jsonb_build_object('flow', v_flow, 'type', p_type, 'department', v_dept));
  end if;

  return v_flow;
end; $$;

-- Duyệt/Từ chối + chặn quản lý duyệt chéo phòng ban
create or replace function decide_request(p_flow uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_role text := auth_role();
  v_flow approval_flows; v_step approval_steps; v_max int; v_next_role text;
  v_my_dept uuid; v_req_dept uuid;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  if p_decision not in ('Duyệt','Từ chối') then raise exception 'Quyết định không hợp lệ'; end if;

  select * into v_flow from approval_flows where id = p_flow;
  if v_flow.id is null then raise exception 'Không tìm thấy yêu cầu'; end if;
  if v_flow.status <> 'Chờ' then raise exception 'Yêu cầu đã được xử lý'; end if;

  select * into v_step from approval_steps where flow_id = p_flow and level = v_flow.current_level;
  if v_role <> v_step.approver_role and v_role <> 'qt_sua' then
    raise exception 'Bạn không có quyền duyệt cấp này';
  end if;

  -- Quản lý chỉ được duyệt yêu cầu của nhân sự CÙNG phòng ban (trưởng phòng của phòng đó)
  if v_role = 'quan_ly' then
    select department_id into v_my_dept from profiles where id = v_uid;
    select department_id into v_req_dept from profiles where id = v_flow.employee_id;
    if v_my_dept is distinct from v_req_dept then
      raise exception 'Chỉ trưởng phòng của phòng ban này mới được duyệt yêu cầu';
    end if;
  end if;

  update approval_steps set decision = p_decision, decided_by = v_uid, decided_at = now(), reason = p_reason
  where id = v_step.id;

  if p_decision = 'Từ chối' then
    update approval_flows set status = 'Từ chối' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Từ chối');
    perform notify_user(v_flow.employee_id, 'Yêu cầu bị từ chối',
      coalesce(p_reason, 'Yêu cầu của bạn đã bị từ chối.'),
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
    return;
  end if;

  select max(level) into v_max from approval_steps where flow_id = p_flow;
  if v_flow.current_level >= v_max then
    update approval_flows set status = 'Duyệt' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Duyệt');
    perform notify_user(v_flow.employee_id, 'Yêu cầu đã được duyệt',
      'Yêu cầu của bạn đã được duyệt ở cấp cuối.',
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
  else
    update approval_flows set current_level = current_level + 1 where id = p_flow;
    select approver_role into v_next_role from approval_steps where flow_id = p_flow and level = v_flow.current_level + 1;
    perform notify_role(v_next_role, 'Có yêu cầu chờ duyệt (cấp tiếp theo)',
      'Một yêu cầu đã qua cấp 1, chờ bạn duyệt cấp cuối.',
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
  end if;
end; $$;

grant execute on function notify_dept_heads(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function submit_request(text, uuid) to authenticated;
grant execute on function decide_request(uuid, text, text) to authenticated;


-- =====================================================================
-- 5Sao HRM — Phân vai trò lại:
--   quan_ly  = HR công ty + Ban lãnh đạo → UI admin, xem/duyệt TOÀN CÔNG TY.
--   Trưởng phòng = NHÂN VIÊN (role nhan_vien) có chức vụ 'Trưởng phòng' → vẫn dùng
--     UI nhân viên, nhưng được NHẬN / XEM / DUYỆT đơn nghỉ phép của phòng mình.
-- Chạy sau 0010. Idempotent.
-- =====================================================================

-- ---------- Helper ----------
create or replace function is_dept_head()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join titles t on t.id = p.title_id
    where p.id = auth.uid() and lower(t.name) = lower('Trưởng phòng')
  );
$$;

-- current user là trưởng phòng CÙNG phòng ban với p_employee (và không phải chính họ)
create or replace function is_dept_head_of(p_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from profiles me join titles t on t.id = me.title_id
    join profiles emp on emp.id = p_employee
    where me.id = auth.uid()
      and lower(t.name) = lower('Trưởng phòng')
      and me.id <> p_employee
      and me.department_id is not null
      and me.department_id = emp.department_id
  );
$$;

-- ---------- RLS: quan_ly (HR/BLD) xem TOÀN CÔNG TY; trưởng phòng xem phòng mình ----------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = auth.uid() or is_admin_any() or is_manager()
  or (is_dept_head() and department_id = my_department())
);

drop policy if exists emploc_select on employee_locations;
create policy emploc_select on employee_locations for select using (
  employee_id = auth.uid() or is_admin_any() or is_manager()
);

drop policy if exists att_select on attendance_records;
create policy att_select on attendance_records for select using (
  employee_id = auth.uid() or is_admin_any() or is_manager()
);

drop policy if exists adj_select on attendance_adjustments;
create policy adj_select on attendance_adjustments for select using (
  employee_id = auth.uid() or is_admin_any() or is_manager()
);
drop policy if exists adj_update on attendance_adjustments;
create policy adj_update on attendance_adjustments for update
  using (is_admin_any() or is_manager());

drop policy if exists leave_select on leave_requests;
create policy leave_select on leave_requests for select using (
  employee_id = auth.uid() or is_admin_any() or is_manager()
  or (is_dept_head() and in_my_scope(employee_id))
);
drop policy if exists leave_update on leave_requests;
create policy leave_update on leave_requests for update
  using (is_admin_any() or is_manager());

drop policy if exists bal_select on leave_balances;
create policy bal_select on leave_balances for select using (
  employee_id = auth.uid() or is_admin_any() or is_manager()
  or (is_dept_head() and in_my_scope(employee_id))
);

drop policy if exists flow_select on approval_flows;
create policy flow_select on approval_flows for select using (
  employee_id = auth.uid() or is_admin_any() or is_manager() or is_dept_head()
);

drop policy if exists step_select on approval_steps;
create policy step_select on approval_steps for select using (
  is_admin_any() or is_manager() or is_dept_head()
  or exists (select 1 from approval_flows f where f.id = flow_id and f.employee_id = auth.uid())
);

-- ---------- Thông báo: chỉ gửi cho TRƯỞNG PHÒNG (chức vụ) của phòng ban ----------
create or replace function notify_dept_heads(p_dept uuid, p_exclude uuid, p_title text, p_body text, p_payload jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_cnt int;
begin
  insert into notifications (user_id, type, title, body, payload)
  select p.id, 'approval', p_title, p_body, p_payload
  from profiles p
  where p.account_status = 'Hoạt động'
    and p.department_id = p_dept
    and p.id <> coalesce(p_exclude, '00000000-0000-0000-0000-000000000000'::uuid)
    and p.title_id in (select id from titles where lower(name) = lower('Trưởng phòng'));
  get diagnostics v_cnt = row_count;
  return coalesce(v_cnt, 0);
end; $$;

-- ---------- Duyệt: quan_ly (toàn công ty) | qt_sua | Trưởng phòng của phòng người gửi ----------
create or replace function decide_request(p_flow uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_role text := auth_role();
  v_flow approval_flows; v_step approval_steps; v_max int; v_next_role text;
  v_can boolean := false;
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  if p_decision not in ('Duyệt','Từ chối') then raise exception 'Quyết định không hợp lệ'; end if;

  select * into v_flow from approval_flows where id = p_flow;
  if v_flow.id is null then raise exception 'Không tìm thấy yêu cầu'; end if;
  if v_flow.status <> 'Chờ' then raise exception 'Yêu cầu đã được xử lý'; end if;

  select * into v_step from approval_steps where flow_id = p_flow and level = v_flow.current_level;

  -- Quyền duyệt cấp hiện tại
  v_can := (v_role = 'qt_sua') or (v_role = v_step.approver_role);
  if (not v_can) and v_step.approver_role = 'quan_ly' and is_dept_head_of(v_flow.employee_id) then
    v_can := true;   -- Trưởng phòng duyệt đơn của nhân sự phòng mình
  end if;
  if not v_can then raise exception 'Bạn không có quyền duyệt yêu cầu này'; end if;

  update approval_steps set decision = p_decision, decided_by = v_uid, decided_at = now(), reason = p_reason
  where id = v_step.id;

  if p_decision = 'Từ chối' then
    update approval_flows set status = 'Từ chối' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Từ chối');
    perform notify_user(v_flow.employee_id, 'Yêu cầu bị từ chối',
      coalesce(p_reason, 'Yêu cầu của bạn đã bị từ chối.'),
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
    return;
  end if;

  select max(level) into v_max from approval_steps where flow_id = p_flow;
  if v_flow.current_level >= v_max then
    update approval_flows set status = 'Duyệt' where id = p_flow;
    perform finalize_request(v_flow.request_type, v_flow.ref_id, 'Duyệt');
    perform notify_user(v_flow.employee_id, 'Yêu cầu đã được duyệt',
      'Yêu cầu của bạn đã được duyệt.',
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
  else
    update approval_flows set current_level = current_level + 1 where id = p_flow;
    select approver_role into v_next_role from approval_steps where flow_id = p_flow and level = v_flow.current_level + 1;
    perform notify_role(v_next_role, 'Có yêu cầu chờ duyệt (cấp tiếp theo)',
      'Một yêu cầu đã qua cấp 1, chờ bạn duyệt cấp cuối.',
      jsonb_build_object('flow', p_flow, 'type', v_flow.request_type));
  end if;
end; $$;

grant execute on function is_dept_head() to authenticated;
grant execute on function is_dept_head_of(uuid) to authenticated;
grant execute on function notify_dept_heads(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function decide_request(uuid, text, text) to authenticated;


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


