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
