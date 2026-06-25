-- =====================================================================
-- 5Sao HRM — DỮ LIỆU TEST (idempotent, ≥10 mỗi tính năng)
-- Domain test: @test.5sao.vn · mật khẩu: Test@123456
-- 12 nhân viên + 3 vai trò quản trị, đầy đủ phòng ban/HĐ/địa điểm.
-- ≥12 chấm công, 10 nghỉ phép, 10 bổ sung công, 10 thông báo.
-- =====================================================================
set search_path = public, extensions;

-- ---------- Dọn dữ liệu test cũ + NV demo ----------
do $$
declare v_ids uuid[];
begin
  select array_agg(id) into v_ids from auth.users
   where email like '%@test.5sao.vn' or email = 'hoa.tt@5sao.vn';
  if v_ids is not null then
    delete from notifications where user_id = any(v_ids);
    delete from audit_logs where actor_id = any(v_ids);
    delete from attendance_adjustments where employee_id = any(v_ids);
    delete from leave_requests where employee_id = any(v_ids);
    delete from approval_steps where flow_id in (select id from approval_flows where employee_id = any(v_ids));
    delete from approval_flows where employee_id = any(v_ids);
    delete from leave_balances where employee_id = any(v_ids);
    delete from employee_files where employee_id = any(v_ids);
    delete from attendance_records where employee_id = any(v_ids);
    delete from employee_locations where employee_id = any(v_ids);
    delete from auth.users where id = any(v_ids);
  end if;
end $$;

-- ---------- Tạo dữ liệu ----------
do $$
declare
  d_kd uuid := (select id from departments where name='Kinh doanh');
  d_it uuid := (select id from departments where name='IT');
  d_mkt uuid := (select id from departments where name='Marketing');
  depts uuid[] := array[d_kd, d_it, d_mkt];
  poss uuid[] := array[(select id from positions where name='Sale'),(select id from positions where name='Dev'),(select id from positions where name='Content')];
  locs uuid[] := array[(select id from locations where name='Trụ sở Hà Nội'),(select id from locations where name='HCM · CN1'),(select id from locations where name='Đà Nẵng')];
  sh_hc uuid := (select id from shifts where name='Hành chính');
  sh_pm uuid := (select id from shifts where name='Ca chiều');
  shs uuid[] := array[sh_hc, sh_pm];
  wt_hc uuid := (select id from work_types where code='HC');
  wts uuid[] := array[(select id from work_types where code='HC'),(select id from work_types where code='TC120'),(select id from work_types where code='TC150'),(select id from work_types where code='ON')];
  contracts text[] := array['Chính thức','Thử việc','TTS'];
  names text[] := array['Nguyễn Văn An','Lê Thị Lan','Vũ Quốc Đức','Trần Quốc Bảo','Phạm Thu Hà','Hoàng Minh Tuấn','Đỗ Thị Mai','Bùi Văn Sơn','Ngô Thanh Tâm','Đặng Hữu Phước','Lý Thị Hồng','Phan Văn Khoa'];
  lt_benh uuid := (select id from leave_types where code='nghi_benh');
  lt_tre uuid := (select id from leave_types where code='di_tre');
  lts uuid[] := array[(select id from leave_types where code='nghi_benh'),(select id from leave_types where code='di_tre'),(select id from leave_types where code='nua_ngay'),(select id from leave_types where code='khong_luong'),(select id from leave_types where code='online')];
  yr int := extract(year from current_date)::int;
  v_id uuid; v_admin uuid; v_mgr uuid; v_emp uuid[] := '{}';
  i int; v_minutes int; v_wt uuid; v_code text; v_status text;
  v_req uuid; v_flow uuid; v_adj uuid; v_lt uuid; v_st text;
begin
  -- 3 vai trò quản trị
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
   values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','hr.admin@test.5sao.vn',crypt('Test@123456',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"QA Quản Trị"}') returning id into v_admin;
  update profiles set role='qt_sua', department_id=d_it, position_id=(select id from positions where department_id=d_it order by name limit 1), contract_type='Chính thức', work_status='Đang làm', phone='0900000001' where id=v_admin;
  insert into employee_locations(employee_id,location_id,shift_id) values (v_admin, locs[1], sh_hc);

  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
   values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','hr.view@test.5sao.vn',crypt('Test@123456',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"QA Quản Trị Xem"}') returning id into v_id;
  update profiles set role='qt_xem', department_id=d_it, position_id=(select id from positions where department_id=d_it order by name limit 1), contract_type='Chính thức', phone='0900000002' where id=v_id;
  insert into employee_locations(employee_id,location_id,shift_id) values (v_id, locs[1], sh_hc);

  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
   values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','minh.ql@test.5sao.vn',crypt('Test@123456',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Đặng Minh"}') returning id into v_mgr;
  update profiles set role='quan_ly', department_id=d_kd, position_id=(select id from positions where department_id=d_kd order by name limit 1), contract_type='Chính thức', phone='0900000003' where id=v_mgr;
  insert into employee_locations(employee_id,location_id,shift_id) values (v_mgr, locs[1], sh_hc);

  -- 12 nhân viên đầy đủ dữ liệu + 1 chấm công mỗi người
  for i in 1..12 loop
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
     values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','nv'||i||'@test.5sao.vn',crypt('Test@123456',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', names[i]))
     returning id into v_id;
    update profiles set role='nhan_vien', full_name=names[i],
      department_id=depts[1+(i%3)], position_id=(select id from positions where department_id=depts[1+(i%3)] order by name limit 1), contract_type=contracts[1+(i%3)],
      work_status = case when i=12 then 'Tạm nghỉ' else 'Đang làm' end,
      account_status = case when i=11 then 'Khóa' else 'Hoạt động' end,
      phone='09011000'||lpad(i::text,2,'0')
     where id=v_id;
    insert into employee_locations(employee_id,location_id,shift_id) values (v_id, locs[1+(i%3)], shs[1+(i%2)]);
    v_emp := array_append(v_emp, v_id);
    insert into leave_balances(employee_id,year,accrued,used,remaining) values (v_id, yr, 12, i%4, 12-(i%4)) on conflict do nothing;

    -- chấm công (1 bản ghi/NV, đa dạng loại + trạng thái)
    v_wt := wts[1+(i%4)]; select code into v_code from work_types where id=v_wt;
    if i % 5 = 0 then
      insert into attendance_records(employee_id,work_type_id,work_date,check_in_at,checkin_status,state)
       values (v_id, wt_hc, current_date-1, ((current_date-1)::timestamp+time '08:00') at time zone 'Asia/Ho_Chi_Minh','Hợp lệ','missing_checkout');
    else
      v_minutes := case when v_code in ('TC120','TC150') then 180 else 500 end;
      v_status := case when i%3=0 then 'Trễ' else 'Hợp lệ' end;
      insert into attendance_records(employee_id,work_type_id,work_date,check_in_at,check_in_lat,check_in_lng,check_out_at,checkin_status,checkout_status,computed_workday,state)
       values (v_id, v_wt, current_date-1,
         ((current_date-1)::timestamp + (case when v_status='Trễ' then time '08:45' else time '08:00' end)) at time zone 'Asia/Ho_Chi_Minh', 21.0,105.8,
         ((current_date-1)::timestamp + time '17:10') at time zone 'Asia/Ho_Chi_Minh',
         v_status,'Hợp lệ', fn_compute_workday(v_code, v_minutes),'complete');
    end if;
  end loop;

  -- Trưởng phòng = NHÂN VIÊN có chức vụ 'Trưởng phòng' (vẫn dùng UI nhân viên),
  -- được nhận/duyệt đơn nghỉ phép của phòng mình. minh.ql giữ quan_ly = HR/BLD (UI admin, toàn công ty).
  update profiles set title_id = (select id from titles where name='Trưởng phòng') where id = v_emp[1]; -- IT: Nguyễn Văn An
  update profiles set title_id = (select id from titles where name='Trưởng phòng') where id = v_emp[2]; -- Marketing: Lê Thị Lan
  update profiles set title_id = (select id from titles where name='Trưởng phòng') where id = v_emp[3]; -- Kinh doanh: Vũ Quốc Đức

  -- 10 đơn nghỉ phép (đa loại + đa trạng thái) + flow
  for i in 1..10 loop
    v_lt := lts[1+(i%5)];
    v_st := (array['Chờ','Duyệt','Không duyệt'])[1+(i%3)];
    insert into leave_requests(employee_id,leave_type_id,start_date,end_date,reason,status,hours,workday_impact,attachment_url)
     values (v_emp[i], v_lt, current_date-(i%5), current_date-(i%5), 'Lý do nghỉ test '||i, v_st,
       case when v_lt=lt_tre then 1.5 else null end,
       case when v_lt=lt_tre then 1.5 else null end,
       case when v_lt=lt_benh then 'leave/giay_benh.jpg' else null end)
     returning id into v_req;
    insert into approval_flows(request_type,employee_id,ref_id,current_level,status)
      values ('leave', v_emp[i], v_req, 1, case when v_st='Không duyệt' then 'Từ chối' else v_st end) returning id into v_flow;
    if v_st='Chờ' then
      insert into approval_steps(flow_id,level,approver_role) values (v_flow,1,'quan_ly');
    elsif v_st='Duyệt' then
      insert into approval_steps(flow_id,level,approver_role,decision,decided_by,decided_at) values (v_flow,1,'quan_ly','Duyệt',v_mgr,now());
    else
      insert into approval_steps(flow_id,level,approver_role,decision,decided_by,decided_at,reason) values (v_flow,1,'quan_ly','Từ chối',v_mgr,now(),'Trùng lịch');
    end if;
    update leave_requests set approval_flow_id=v_flow where id=v_req;
  end loop;

  -- Thêm đơn 'Chờ' cho 1 NV IT và 1 NV Marketing để mỗi trưởng phòng có đơn để duyệt thử
  insert into leave_requests(employee_id,leave_type_id,start_date,end_date,reason,status)
    values (v_emp[4], lt_benh, current_date, current_date, 'Nghỉ ốm (chờ TP IT duyệt)', 'Chờ') returning id into v_req;
  insert into approval_flows(request_type,employee_id,ref_id,current_level,status)
    values ('leave', v_emp[4], v_req, 1, 'Chờ') returning id into v_flow;
  insert into approval_steps(flow_id,level,approver_role) values (v_flow,1,'quan_ly');
  update leave_requests set approval_flow_id=v_flow where id=v_req;

  insert into leave_requests(employee_id,leave_type_id,start_date,end_date,reason,status)
    values (v_emp[5], lt_benh, current_date, current_date, 'Nghỉ ốm (chờ TP Marketing duyệt)', 'Chờ') returning id into v_req;
  insert into approval_flows(request_type,employee_id,ref_id,current_level,status)
    values ('leave', v_emp[5], v_req, 1, 'Chờ') returning id into v_flow;
  insert into approval_steps(flow_id,level,approver_role) values (v_flow,1,'quan_ly');
  update leave_requests set approval_flow_id=v_flow where id=v_req;

  -- 10 bổ sung công (2 cấp) + flow
  for i in 1..10 loop
    v_st := (array['Chờ','Duyệt','Từ chối'])[1+(i%3)];
    insert into attendance_adjustments(employee_id,kind,reason,status) values (v_emp[i],'forgot_checkout','Quên check-out test '||i, v_st) returning id into v_adj;
    insert into approval_flows(request_type,employee_id,ref_id,current_level,status) values ('attendance_adjustment', v_emp[i], v_adj, case when v_st='Chờ' then 1 else 2 end, v_st) returning id into v_flow;
    insert into approval_steps(flow_id,level,approver_role,decision,decided_by,decided_at)
      values (v_flow,1,'quan_ly', case when v_st='Chờ' then 'Chờ' else 'Duyệt' end, case when v_st='Chờ' then null else v_mgr end, case when v_st='Chờ' then null else now() end);
    insert into approval_steps(flow_id,level,approver_role,decision,decided_by,decided_at)
      values (v_flow,2,'qt_sua', case when v_st='Duyệt' then 'Duyệt' when v_st='Từ chối' then 'Từ chối' else 'Chờ' end, case when v_st in ('Duyệt','Từ chối') then v_admin else null end, case when v_st in ('Duyệt','Từ chối') then now() else null end);
    update attendance_adjustments set approval_flow_id=v_flow where id=v_adj;
  end loop;

  -- 10 thông báo cho quản lý
  for i in 1..10 loop
    insert into notifications(user_id,type,title,body) values (v_mgr,'approval','Có yêu cầu chờ duyệt','Yêu cầu chờ duyệt #'||i);
  end loop;
end $$;

-- Chuẩn hoá cột token/change của auth.users (NULL gây lỗi GoTrue)
do $$
declare col text;
begin
  for col in select column_name from information_schema.columns
    where table_schema='auth' and table_name='users'
      and data_type in ('character varying','text')
      and (column_name like '%token%' or column_name like '%change%')
  loop
    execute format('update auth.users set %I = '''' where %I is null and email like ''%%@test.5sao.vn''', col, col);
  end loop;
end $$;

-- Lấp dữ liệu null cho MỌI hồ sơ (kể cả admin thật) để dashboard khớp tổng,
-- và đảm bảo mọi hồ sơ có ít nhất 1 địa điểm.
update profiles set
  contract_type = coalesce(contract_type, 'Chính thức'),
  department_id = coalesce(department_id, (select id from departments where name='IT')),
  position_id   = coalesce(position_id, (select id from positions where name='Dev'))
where contract_type is null or department_id is null or position_id is null;

insert into employee_locations(employee_id, location_id, shift_id)
select p.id, (select id from locations where name='Trụ sở Hà Nội'), (select id from shifts where name='Hành chính')
from profiles p
where not exists (select 1 from employee_locations el where el.employee_id = p.id);

-- Chức vụ mặc định 'Nhân viên' cho nhân sự test chưa có (trưởng phòng đã gán ở trên)
update profiles p set title_id = (select id from titles where name='Nhân viên')
from auth.users u
where u.id = p.id and u.email like '%@test.5sao.vn' and p.title_id is null;
