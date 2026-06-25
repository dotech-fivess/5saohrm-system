-- =====================================================================
-- 5Sao HRM — M1 hoàn thiện: bảng metadata file hồ sơ (S7)
-- 1 dòng / (nhân viên × loại tài liệu); thay thế = cập nhật dòng + tăng version.
-- Chạy sau 0006. Idempotent.
-- =====================================================================

create table if not exists employee_files (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  doc_type text not null check (doc_type in ('CCCD','Hợp đồng','CV','Cam kết')),
  storage_path text not null,
  file_name text,
  size bigint,
  version int not null default 1,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, doc_type)
);

alter table employee_files enable row level security;

drop policy if exists empfile_select on employee_files;
create policy empfile_select on employee_files for select using (
  employee_id = auth.uid() or is_admin_any() or (is_manager() and in_my_scope(employee_id))
);
drop policy if exists empfile_write on employee_files;
create policy empfile_write on employee_files for all
  using (is_qt_sua()) with check (is_qt_sua());

-- Cho phép xoá object trong bucket 'ho-so' (0003 chưa có policy delete)
drop policy if exists hoso_delete on storage.objects;
create policy hoso_delete on storage.objects for delete
  using (bucket_id = 'ho-so' and auth.uid() is not null);
