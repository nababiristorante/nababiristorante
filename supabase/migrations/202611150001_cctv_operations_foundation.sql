-- NVR-independent operations foundation. No camera feeds, images, or recordings are stored here.
-- Camera-triggered automation remains disabled until the Hikvision model/firmware is verified.

create table if not exists public.cctv_monitoring_settings (
  id boolean primary key default true check (id = true),
  cleaning_delay_minutes integer not null default 2 check (cleaning_delay_minutes in (2, 3)),
  italian_voice_enabled boolean not null default true,
  automatic_announcements_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.cctv_monitoring_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.cctv_table_tasks (
  id uuid primary key default gen_random_uuid(),
  room_key text not null check (room_key in ('dining-1', 'dining-2')),
  table_number integer not null check (table_number between 1 and 10),
  task_type text not null default 'cleaning' check (task_type in ('cleaning', 'water', 'waiter')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'camera_ai')),
  detected_empty_at timestamptz,
  due_at timestamptz,
  assigned_staff_id uuid references public.staff(id) on delete set null,
  assigned_staff_name text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint cctv_table_number_matches_room check (
    (room_key = 'dining-1' and table_number between 1 and 3)
    or (room_key = 'dining-2' and table_number between 1 and 7)
  )
);

create index if not exists cctv_table_tasks_status_due_idx
  on public.cctv_table_tasks (status, due_at);
create index if not exists cctv_table_tasks_created_idx
  on public.cctv_table_tasks (created_at desc);

-- Prevent duplicate active tasks for the same table and task type.
create unique index if not exists cctv_table_tasks_one_active_per_table_idx
  on public.cctv_table_tasks (room_key, table_number, task_type)
  where status in ('pending', 'in_progress');

create table if not exists public.cctv_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null check (alert_type in ('camera_offline', 'nvr_offline', 'task_overdue', 'task_completed')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  camera_key text references public.cctv_cameras(camera_key) on update cascade on delete set null,
  task_id uuid references public.cctv_table_tasks(id) on delete set null,
  message text not null,
  occurred_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists cctv_alerts_occurred_idx on public.cctv_alerts (occurred_at desc);
create index if not exists cctv_alerts_unacknowledged_idx on public.cctv_alerts (occurred_at desc) where acknowledged_at is null;

alter table public.cctv_monitoring_settings enable row level security;
alter table public.cctv_table_tasks enable row level security;
alter table public.cctv_alerts enable row level security;

drop policy if exists nababi_admin_manage_cctv_monitoring_settings on public.cctv_monitoring_settings;
create policy nababi_admin_manage_cctv_monitoring_settings
  on public.cctv_monitoring_settings for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists nababi_admin_manage_cctv_table_tasks on public.cctv_table_tasks;
create policy nababi_admin_manage_cctv_table_tasks
  on public.cctv_table_tasks for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists nababi_admin_manage_cctv_alerts on public.cctv_alerts;
create policy nababi_admin_manage_cctv_alerts
  on public.cctv_alerts for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

grant select, insert, update, delete on public.cctv_monitoring_settings to authenticated;
grant select, insert, update, delete on public.cctv_table_tasks to authenticated;
grant select, insert, update, delete on public.cctv_alerts to authenticated;
grant all on public.cctv_monitoring_settings, public.cctv_table_tasks, public.cctv_alerts to service_role;
