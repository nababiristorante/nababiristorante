-- NVR-independent cleaning deadlines and idempotent overdue alerts.
-- A manual cleaning task starts its timer when an admin creates it.
-- Camera-triggered empty-table detection remains disabled until NVR compatibility is verified.

alter table public.cctv_table_tasks
  add column if not exists overdue_alerted_at timestamptz;

create or replace function public.cctv_process_overdue_tasks()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  task_row record;
  processed_count integer := 0;
begin
  for task_row in
    update public.cctv_table_tasks
       set overdue_alerted_at = now(),
           updated_at = now()
     where status in ('pending', 'in_progress')
       and due_at is not null
       and due_at <= now()
       and overdue_alerted_at is null
    returning id, room_key, table_number, task_type
  loop
    insert into public.cctv_alerts (
      alert_type, severity, task_id, message, occurred_at
    ) values (
      'task_overdue',
      'warning',
      task_row.id,
      case task_row.task_type
        when 'cleaning' then 'Pulizia in ritardo · '
        when 'water' then 'Acqua in ritardo · '
        when 'waiter' then 'Cameriere in ritardo · '
        else 'Attività in ritardo · '
      end || task_row.room_key || ' · tavolo ' || task_row.table_number,
      now()
    );
    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

revoke all on function public.cctv_process_overdue_tasks() from public;
revoke all on function public.cctv_process_overdue_tasks() from anon;
revoke all on function public.cctv_process_overdue_tasks() from authenticated;
grant execute on function public.cctv_process_overdue_tasks() to service_role;

-- Schedule once per minute when Supabase pg_cron is already enabled.
-- If pg_cron is unavailable, the function remains installed but no background
-- schedule is created; enable pg_cron and rerun this migration to schedule it.
do $$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    if not exists (
      select 1 from cron.job
      where jobname = 'nababi-cctv-overdue-tasks'
    ) then
      perform cron.schedule(
        'nababi-cctv-overdue-tasks',
        '* * * * *',
        'select public.cctv_process_overdue_tasks();'
      );
    end if;
  end if;
end;
$$;
