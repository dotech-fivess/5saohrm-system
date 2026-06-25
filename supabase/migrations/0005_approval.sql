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
