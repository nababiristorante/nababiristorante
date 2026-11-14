-- Nababi AI Monitoring foundation: metadata/events only; no video or audio storage.
create table if not exists public.cctv_cameras (
  id uuid primary key default gen_random_uuid(),
  camera_key text not null unique,
  display_name text not null,
  area text not null,
  display_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cctv_events (
  id uuid primary key default gen_random_uuid(),
  camera_key text not null references public.cctv_cameras(camera_key) on update cascade,
  event_type text not null,
  event_at timestamptz not null default now(),
  staff_id uuid references public.staff(id) on delete set null,
  staff_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cctv_events_event_at_idx on public.cctv_events (event_at desc);
create index if not exists cctv_events_camera_event_at_idx on public.cctv_events (camera_key, event_at desc);

alter table public.cctv_cameras enable row level security;
alter table public.cctv_events enable row level security;

drop policy if exists nababi_admin_read_cctv_cameras on public.cctv_cameras;
create policy nababi_admin_read_cctv_cameras on public.cctv_cameras for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists nababi_admin_manage_cctv_cameras on public.cctv_cameras;
create policy nababi_admin_manage_cctv_cameras on public.cctv_cameras for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists nababi_admin_read_cctv_events on public.cctv_events;
create policy nababi_admin_read_cctv_events on public.cctv_events for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

grant select, insert, update, delete on public.cctv_cameras to authenticated;
grant select on public.cctv_events to authenticated;
grant all on public.cctv_cameras, public.cctv_events to service_role;

insert into public.cctv_cameras (camera_key, display_name, area, display_order)
values ('dining-1', 'Dining Room 1', '3 tables', 1),
       ('dining-2', 'Dining Room 2', '7 tables', 2),
       ('cash', 'Cash Counter', 'Cash counter', 3),
       ('kitchen', 'Kitchen', 'Kitchen', 4)
on conflict (camera_key) do update set display_name=excluded.display_name, area=excluded.area, display_order=excluded.display_order;
