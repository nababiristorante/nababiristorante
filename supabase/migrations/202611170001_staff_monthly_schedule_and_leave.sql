-- NABABI monthly staff schedules and leave planner.
-- Admin-only access; does not alter staff authentication or attendance records.
create table if not exists public.staff_monthly_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete set null,
  staff_name text not null,
  work_date date not null,
  start_time time,
  end_time time,
  break_start time,
  break_end time,
  day_status text not null default 'work'
    check (day_status in ('work','full_leave','half_leave')),
  leave_reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_monthly_schedules_staff_day_unique unique (staff_id, work_date),
  constraint staff_monthly_schedules_time_order check (
    start_time is null or end_time is null or start_time < end_time
  ),
  constraint staff_monthly_schedules_break_order check (
    break_start is null or break_end is null or break_start < break_end
  )
);

create index if not exists staff_monthly_schedules_work_date_idx
  on public.staff_monthly_schedules(work_date, staff_name);

alter table public.staff_monthly_schedules enable row level security;
drop policy if exists nababi_admin_manage_staff_monthly_schedules
  on public.staff_monthly_schedules;
create policy nababi_admin_manage_staff_monthly_schedules
  on public.staff_monthly_schedules
  for all to authenticated
  using (exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  ));

grant select, insert, update, delete on public.staff_monthly_schedules to authenticated;
