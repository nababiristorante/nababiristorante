-- Camera-detection inbox for the future Hikvision cash-drawer integration.
-- This migration does NOT connect to a camera or create cash ledger entries.
-- No image or video data is stored here; only event metadata and detection results.

create table if not exists public.cash_drawer_camera_detections (
  id uuid primary key default gen_random_uuid(),
  camera_id text not null,
  camera_channel integer,
  source_event_id text,
  detected_at timestamptz not null,
  direction text check (direction in ('in', 'out')),
  denomination integer check (denomination in (5, 10, 20, 50, 100, 200, 500)),
  quantity integer check (quantity between 1 and 10000),
  confidence numeric(5,4) check (confidence >= 0 and confidence <= 1),
  detection_status text not null default 'pending'
    check (detection_status in ('pending', 'needs_review', 'recorded', 'rejected')),
  cash_drawer_entry_id uuid unique
    references public.cash_drawer_entries(id) on delete set null,
  event_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_metadata) = 'object'),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint cash_drawer_camera_detection_result_check check (
    detection_status not in ('pending', 'needs_review')
    or cash_drawer_entry_id is null
  )
);

create unique index if not exists cash_drawer_camera_detection_source_uidx
  on public.cash_drawer_camera_detections(camera_id, source_event_id)
  where source_event_id is not null;

create index if not exists cash_drawer_camera_detections_status_time_idx
  on public.cash_drawer_camera_detections(detection_status, detected_at desc);

alter table public.cash_drawer_camera_detections enable row level security;

drop policy if exists nababi_admin_read_cash_drawer_camera_detections
  on public.cash_drawer_camera_detections;
create policy nababi_admin_read_cash_drawer_camera_detections
  on public.cash_drawer_camera_detections
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

-- Camera/backend ingestion is reserved for trusted server-side service-role code.
-- Authenticated browser users receive read-only access through the admin policy.
grant select on public.cash_drawer_camera_detections to authenticated;
grant select, insert, update on public.cash_drawer_camera_detections to service_role;
