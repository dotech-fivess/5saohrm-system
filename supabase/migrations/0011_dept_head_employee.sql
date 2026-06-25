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
