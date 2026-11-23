-- Optional, admin-created event certificates. No booking is automatically converted.
create table if not exists public.event_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  recipient_name text not null check (char_length(btrim(recipient_name)) between 1 and 140),
  event_type text not null check (event_type in ('birthday','special_event')),
  event_date date not null,
  photo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_certificates_created_at_idx
  on public.event_certificates (created_at desc);

alter table public.event_certificates enable row level security;

drop policy if exists "Admins can manage event certificates" on public.event_certificates;
create policy "Admins can manage event certificates"
  on public.event_certificates
  for all
  to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));

grant select, insert, update, delete on public.event_certificates to authenticated;
