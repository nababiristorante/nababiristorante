-- NABABI public media bucket and Admin-only upload management.
-- Public reads are intentional because the website uses getPublicUrl() for media.
insert into storage.buckets (id, name, public)
values ('nababi-media', 'nababi-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists nababi_public_read_media on storage.objects;
create policy nababi_public_read_media
on storage.objects for select
to anon, authenticated
using (bucket_id = 'nababi-media');

drop policy if exists nababi_admin_upload_media on storage.objects;
create policy nababi_admin_upload_media
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'nababi-media'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);

drop policy if exists nababi_admin_update_media on storage.objects;
create policy nababi_admin_update_media
on storage.objects for update
to authenticated
using (
  bucket_id = 'nababi-media'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
)
with check (
  bucket_id = 'nababi-media'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);

drop policy if exists nababi_admin_delete_media on storage.objects;
create policy nababi_admin_delete_media
on storage.objects for delete
to authenticated
using (
  bucket_id = 'nababi-media'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);
