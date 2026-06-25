-- =====================================================================
-- 5Sao HRM — Vị trí thuộc theo Phòng ban
-- Mỗi phòng ban có danh sách vị trí riêng. Cho phép trùng tên vị trí
-- ở các phòng ban khác nhau (unique theo (department_id, name)).
-- Chạy sau 0008. Idempotent.
-- =====================================================================

alter table positions add column if not exists department_id uuid references departments(id) on delete cascade;

-- Gán phòng ban cho các vị trí cũ (theo tên quen thuộc) nếu còn null
update positions set department_id = (select id from departments where name='Marketing')
  where lower(name) = 'content' and department_id is null;
update positions set department_id = (select id from departments where name='IT')
  where lower(name) = 'dev' and department_id is null;
update positions set department_id = (select id from departments where name='Kinh doanh')
  where lower(name) = 'sale' and department_id is null;

-- Bỏ unique(name) cũ, thêm unique theo (phòng ban, tên)
alter table positions drop constraint if exists positions_name_key;
create unique index if not exists positions_dept_name_uniq on positions (department_id, name);
