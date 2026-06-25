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
