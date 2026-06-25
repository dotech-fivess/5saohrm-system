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
