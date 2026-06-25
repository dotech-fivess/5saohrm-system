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
