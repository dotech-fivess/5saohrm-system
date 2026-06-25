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
