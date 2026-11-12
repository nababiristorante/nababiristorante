-- Secure Super Admin manual attendance event insertion.
-- Direct INSERT on staff_attendance_events remains unavailable to browser clients.
create or replace function public.admin_manual_staff_attendance_event(
  p_staff_id uuid,
  p_event_type text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_staff public.staff%rowtype;
  v_day date;
  v_last_event text;
  v_last_at timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users as au
    where au.user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'message', 'শুধু Super Admin এই কাজ করতে পারবেন।');
  end if;

  if p_staff_id is null
     or p_event_type not in ('check_in', 'check_out')
     or p_occurred_at is null then
    return jsonb_build_object('ok', false, 'message', 'Attendance তথ্য সঠিক নয়।');
  end if;

  if p_occurred_at > pg_catalog.clock_timestamp() + interval '5 minutes' then
    return jsonb_build_object('ok', false, 'message', 'ভবিষ্যতের সময় দিয়ে Attendance রেকর্ড করা যাবে না।');
  end if;

  select *
    into v_staff
  from public.staff as s
  where s.id = p_staff_id
    and s.is_active is true
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'সক্রিয় Staff পাওয়া যায়নি।');
  end if;

  v_day := (p_occurred_at at time zone 'Europe/Rome')::date;

  -- Do not insert an event before an already-recorded later event on that day.
  if exists (
    select 1
    from public.staff_attendance_events as e
    where e.staff_id = p_staff_id
      and (e.occurred_at at time zone 'Europe/Rome')::date = v_day
      and e.occurred_at >= p_occurred_at
  ) then
    return jsonb_build_object('ok', false, 'message', 'এই তারিখে এর পরের Attendance রেকর্ড আছে। আগে সেটি যাচাই করুন।');
  end if;

  select e.event_type, e.occurred_at
    into v_last_event, v_last_at
  from public.staff_attendance_events as e
  where e.staff_id = p_staff_id
    and (e.occurred_at at time zone 'Europe/Rome')::date = v_day
    and e.occurred_at < p_occurred_at
  order by e.occurred_at desc
  limit 1;

  if p_event_type = 'check_in' and v_last_event = 'check_in' then
    return jsonb_build_object('ok', false, 'message', 'আগের Check-in এখনো খোলা আছে। আগে Check-out রেকর্ড করুন।');
  end if;

  if p_event_type = 'check_out' and v_last_event is distinct from 'check_in' then
    return jsonb_build_object('ok', false, 'message', 'এই সময়ের আগে খোলা Check-in পাওয়া যায়নি।');
  end if;

  insert into public.staff_attendance_events (
    staff_id, event_type, occurred_at, source
  ) values (
    p_staff_id, p_event_type, p_occurred_at, 'admin_manual'
  );

  insert into public.staff_activity_logs (
    staff_id, staff_name, action, details
  ) values (
    p_staff_id,
    v_staff.full_name,
    case when p_event_type = 'check_in' then 'CHECKIN' else 'CHECKOUT' end,
    'Manual attendance recorded by Super Admin'
  );

  return jsonb_build_object(
    'ok', true,
    'staff_id', p_staff_id,
    'staff_name', v_staff.full_name,
    'event', p_event_type,
    'occurred_at', p_occurred_at
  );
end;
$function$;

revoke all on function public.admin_manual_staff_attendance_event(uuid, text, timestamptz) from public;
revoke all on function public.admin_manual_staff_attendance_event(uuid, text, timestamptz) from anon;
grant execute on function public.admin_manual_staff_attendance_event(uuid, text, timestamptz) to authenticated;
