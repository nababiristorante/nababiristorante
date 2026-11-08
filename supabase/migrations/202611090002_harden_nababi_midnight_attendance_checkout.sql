-- NABABI RISTORANTE: harden Rome-midnight attendance checkout.
-- This is a follow-up migration; do not rerun the already-applied 202611090001 migration.

CREATE OR REPLACE FUNCTION public.nababi_auto_midnight_checkout()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_now timestamptz;
  v_today date;
  v_closed integer := 0;
  v_open record;
  v_midnight timestamptz;
BEGIN
  -- Serialize executions so overlapping cron runs cannot create duplicate events.
  PERFORM pg_catalog.pg_advisory_xact_lock(20261109, 1);

  -- Use the actual execution clock after acquiring the lock, not transaction start time.
  v_now := pg_catalog.clock_timestamp();
  v_today := (v_now AT TIME ZONE 'Europe/Rome')::date;

  FOR v_open IN
    SELECT latest.staff_id,
           (latest.occurred_at AT TIME ZONE 'Europe/Rome')::date AS work_day
    FROM (
      SELECT DISTINCT ON (e.staff_id)
             e.staff_id, e.event_type, e.occurred_at
      FROM public.staff_attendance_events AS e
      ORDER BY e.staff_id, e.occurred_at DESC, e.id DESC
    ) AS latest
    WHERE latest.event_type = 'check_in'
      AND (latest.occurred_at AT TIME ZONE 'Europe/Rome')::date < v_today
  LOOP
    v_midnight := pg_catalog.make_timestamptz(
      EXTRACT(YEAR FROM v_open.work_day + 1)::integer,
      EXTRACT(MONTH FROM v_open.work_day + 1)::integer,
      EXTRACT(DAY FROM v_open.work_day + 1)::integer,
      0, 0, 0,
      'Europe/Rome'
    );

    INSERT INTO public.staff_attendance_events
      (staff_id, event_type, occurred_at, source)
    VALUES
      (v_open.staff_id, 'check_out', v_midnight, 'auto_midnight');

    UPDATE public.staff_attendance
       SET check_out = TIME '00:00',
           status = COALESCE(status, 'present')
     WHERE staff_id = v_open.staff_id
       AND work_date = v_open.work_day;

    v_closed := v_closed + 1;
  END LOOP;

  RETURN v_closed;
END;
$function$;
