-- Public events and Super Admin event management.
-- Existing events rows are preserved; newly created events are unpublished by default.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists is_published boolean not null default false;

alter table public.events enable row level security;

drop policy if exists "Public can view published Nababi events" on public.events;
create policy "Public can view published Nababi events"
  on public.events
  for select
  to anon, authenticated
  using (is_published = true and (ends_at is null or ends_at >= now()));

drop policy if exists "Admins manage Nababi events" on public.events;
create policy "Admins manage Nababi events"
  on public.events
  for all
  to authenticated
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
