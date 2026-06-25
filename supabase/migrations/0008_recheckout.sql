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
