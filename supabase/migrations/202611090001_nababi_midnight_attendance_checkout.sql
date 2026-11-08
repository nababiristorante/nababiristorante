-- NABABI RISTORANTE: close any open attendance shift at the Europe/Rome day boundary.
-- Safe to run repeatedly. The event stream remains the source of truth.

CREATE OR REPLACE FUNCTION public.nababi_auto_midnight_checkout()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_today date := (pg_catalog.now() AT TIME ZONE 'Europe/Rome')::date;
  v_closed integer := 0;
  v_open record;
  v_midnight timestamptz;
BEGIN
  -- Find each staff member's latest event. Only a latest check_in from an
  -- earlier Rome calendar date represents a shift left open overnight.
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

    -- Record the checkout at the exact local midnight, even if the cron
    -- invocation itself was delayed.
    INSERT INTO public.staff_attendance_events
      (staff_id, event_type, occurred_at, source)
    VALUES
      (v_open.staff_id, 'check_out', v_midnight, 'auto_midnight');

    -- Keep the legacy daily summary in sync for the previous work date.
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

-- Run every minute. The function calculates the exact Europe/Rome midnight
-- from each open shift, so it also safely catches a delayed cron execution.
DO $schedule$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'nababi-midnight-attendance-checkout'
  ) THEN
    PERFORM cron.schedule(
      'nababi-midnight-attendance-checkout',
      '* * * * *',
      'SELECT public.nababi_auto_midnight_checkout();'
    );
  END IF;
END;
$schedule$;
