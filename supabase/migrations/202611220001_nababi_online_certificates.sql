-- Nababi online certificate registry and public verification.
-- Safe, additive: does not alter bookings, authentication, attendance or CCTV.

create sequence if not exists public.nababi_certificate_code_seq;

create table if not exists public.nababi_certificate_settings (
  id boolean primary key default true check (id = true),
  signer_name text not null default 'Direzione — Nababi Ristorante',
  signer_role text not null default 'Direzione',
  signature_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.nababi_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text unique,
  certificate_type text not null check (certificate_type in ('birthday','event')),
  recipient_name text not null,
  event_name text,
  issue_date date not null,
  dedication text,
  photo_url text,
  show_photo_publicly boolean not null default false,
  signer_name text not null default 'Direzione — Nababi Ristorante',
  signer_role text,
  signature_url text,
  status text not null default 'active' check (status in ('active','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nababi_event_name_required check (
    certificate_type <> 'event' or nullif(trim(event_name),'') is not null
  )
);

create or replace function public.nababi_assign_certificate_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
begin
  if new.certificate_code is null or trim(new.certificate_code) = '' then
    v_prefix := case when new.certificate_type = 'birthday' then 'BD' else 'EV' end;
    new.certificate_code :=
      'NAB-' || to_char(coalesce(new.issue_date, current_date),'YYYY') || '-' ||
      v_prefix || '-' ||
      lpad(nextval('public.nababi_certificate_code_seq')::text,6,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists nababi_certificate_code_before_insert on public.nababi_certificates;
create trigger nababi_certificate_code_before_insert
before insert on public.nababi_certificates
for each row execute function public.nababi_assign_certificate_code();

create or replace function public.nababi_touch_certificate_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists nababi_certificate_updated_at on public.nababi_certificates;
create trigger nababi_certificate_updated_at
before update on public.nababi_certificates
for each row execute function public.nababi_touch_certificate_updated_at();

alter table public.nababi_certificates enable row level security;
alter table public.nababi_certificate_settings enable row level security;

drop policy if exists nababi_admin_manage_certificates on public.nababi_certificates;
create policy nababi_admin_manage_certificates
on public.nababi_certificates for all to authenticated
using (
  auth.uid() = 'b675670c-8078-4c79-a843-31baa5f68afd'::uuid
  or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
)
with check (
  auth.uid() = 'b675670c-8078-4c79-a843-31baa5f68afd'::uuid
  or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);

drop policy if exists nababi_admin_manage_certificate_settings on public.nababi_certificate_settings;
create policy nababi_admin_manage_certificate_settings
on public.nababi_certificate_settings for all to authenticated
using (
  auth.uid() = 'b675670c-8078-4c79-a843-31baa5f68afd'::uuid
  or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
)
with check (
  auth.uid() = 'b675670c-8078-4c79-a843-31baa5f68afd'::uuid
  or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);

grant select, insert, update on public.nababi_certificates to authenticated;
grant select, insert, update on public.nababi_certificate_settings to authenticated;
revoke all on public.nababi_certificates from anon;
revoke all on public.nababi_certificate_settings from anon;
grant usage, select on sequence public.nababi_certificate_code_seq to authenticated;

insert into public.nababi_certificate_settings (id)
values (true)
on conflict (id) do nothing;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('nababi-certificates','nababi-certificates',true,4194304,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=4194304,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists nababi_public_read_certificate_assets on storage.objects;
create policy nababi_public_read_certificate_assets
on storage.objects for select to anon, authenticated
using (bucket_id = 'nababi-certificates');

drop policy if exists nababi_admin_upload_certificate_assets on storage.objects;
create policy nababi_admin_upload_certificate_assets
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nababi-certificates'
  and (
    auth.uid() = 'b675670c-8078-4c79-a843-31baa5f68afd'::uuid
    or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
);

drop policy if exists nababi_admin_update_certificate_assets on storage.objects;
create policy nababi_admin_update_certificate_assets
on storage.objects for update to authenticated
using (
  bucket_id = 'nababi-certificates'
  and (
    auth.uid() = 'b675670c-8078-4c79-a843-31baa5f68afd'::uuid
    or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
)
with check (
  bucket_id = 'nababi-certificates'
  and (
    auth.uid() = 'b675670c-8078-4c79-a843-31baa5f68afd'::uuid
    or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
);

create or replace function public.nababi_verify_certificate(p_code text)
returns table (
  certificate_code text,
  certificate_type text,
  recipient_name text,
  event_name text,
  issue_date date,
  dedication text,
  photo_url text,
  show_photo_publicly boolean,
  signer_name text,
  signer_role text,
  signature_url text,
  verification_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.certificate_code,
    c.certificate_type,
    case when c.status = 'active' then c.recipient_name else null end,
    case when c.status = 'active' then c.event_name else null end,
    case when c.status = 'active' then c.issue_date else null end,
    case when c.status = 'active' then c.dedication else null end,
    case when c.status = 'active' and c.show_photo_publicly then c.photo_url else null end,
    (c.status = 'active' and c.show_photo_publicly),
    case when c.status = 'active' then c.signer_name else null end,
    case when c.status = 'active' then c.signer_role else null end,
    case when c.status = 'active' then c.signature_url else null end,
    c.status
  from public.nababi_certificates c
  where upper(trim(c.certificate_code)) = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.nababi_verify_certificate(text) from public;
grant execute on function public.nababi_verify_certificate(text) to anon, authenticated;
