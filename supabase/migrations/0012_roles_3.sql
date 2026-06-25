-- =====================================================================
-- 5Sao HRM — Gộp vai trò còn 3: admin | quan_ly | nhan_vien
--   qt_sua + qt_xem  →  admin  (toàn quyền: đọc + ghi, duyệt cấp cuối)
--   quan_ly = Quản lý / Trưởng phòng (giữ nguyên quyền)
--   nhan_vien = Nhân viên
-- Chạy SAU 0011. Idempotent.
-- =====================================================================

-- ---------- 1) Cột role: di trú dữ liệu + ràng buộc mới ----------
alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'admin' where role in ('qt_sua', 'qt_xem');
alter table profiles
  add constraint profiles_role_check check (role in ('admin', 'quan_ly', 'nhan_vien'));
alter table profiles alter column role set default 'nhan_vien';

-- ---------- 2) RLS helper: admin = toàn quyền (đọc + ghi) ----------
create or replace function is_qt_sua()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'admin', false);
$$;

create or replace function is_admin_any()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'admin', false);
$$;

-- ---------- 3) Dữ liệu luồng duyệt đang chờ: qt_sua → admin ----------
update approval_steps set approver_role = 'admin' where approver_role = 'qt_sua';

-- ---------- 4) submit_request: bước duyệt 'qt_sua' → 'admin' ----------
-- (giữ nguyên thân hàm bản 0010, chỉ thay literal vai trò admin)
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
    values (v_flow, 1, 'quan_ly'), (v_flow, 2, 'admin');
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

  -- Báo cho trưởng phòng đúng phòng ban; nếu phòng chưa có trưởng phòng → báo admin
  v_cnt := notify_dept_heads(v_dept, v_uid, 'Có yêu cầu chờ duyệt', v_body,
    jsonb_build_object('flow', v_flow, 'type', p_type, 'department', v_dept));
  if v_cnt = 0 then
    perform notify_role('admin', 'Có yêu cầu chờ duyệt (phòng chưa có trưởng phòng)',
      v_body, jsonb_build_object('flow', v_flow, 'type', p_type, 'department', v_dept));
  end if;

  return v_flow;
end; $$;

-- ---------- 5) decide_request: quyền admin thay cho qt_sua ----------
-- (giữ nguyên thân hàm bản 0011, chỉ thay literal vai trò admin)
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
  v_can := (v_role = 'admin') or (v_role = v_step.approver_role);
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

grant execute on function submit_request(text, uuid) to authenticated;
grant execute on function decide_request(uuid, text, text) to authenticated;
