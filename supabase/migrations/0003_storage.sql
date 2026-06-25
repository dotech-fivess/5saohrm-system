-- =====================================================================
-- 5Sao HRM — Storage bucket cho file hồ sơ (S7)
-- Chạy sau 0002_rls.sql.
-- =====================================================================

-- Bucket 'ho-so' (private)
insert into storage.buckets (id, name, public)
values ('ho-so', 'ho-so', false)
on conflict (id) do nothing;

-- RLS cho object trong bucket 'ho-so' (MVP: cho user đã đăng nhập đọc/ghi;
-- siết theo chủ sở hữu/scope sẽ làm ở giai đoạn sau).
drop policy if exists hoso_read on storage.objects;
create policy hoso_read on storage.objects for select
  using (bucket_id = 'ho-so' and auth.uid() is not null);

drop policy if exists hoso_insert on storage.objects;
create policy hoso_insert on storage.objects for insert
  with check (bucket_id = 'ho-so' and auth.uid() is not null);

drop policy if exists hoso_update on storage.objects;
create policy hoso_update on storage.objects for update
  using (bucket_id = 'ho-so' and auth.uid() is not null);
