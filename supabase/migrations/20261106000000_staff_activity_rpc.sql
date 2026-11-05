-- Secure Staff Activity Log RPC for NABABI RISTORANTE
-- Uses the existing staff_activity_logs columns only:
-- id, staff_id, staff_name, action, details, created_at.
-- Does not alter existing RLS policies or existing rows.

create or replace function public.record_staff_activity(
  p_action text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_staff_id uuid;
  v_staff_name text;
  v_is_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_action is null or length(btrim(p_action)) = 0 then
    raise exception 'Activity action is required';
  end if;

  if length(p_action) > 120 or coalesce(length(p_details), 0) > 2000 then
    raise exception 'Activity text is too long';
  end if;

  select exists (
    select 1
    from public.admin_users au
    where au.user_id = v_uid
  ) into v_is_admin;

  if v_is_admin then
    v_staff_name := 'Super Admin';
  else
    select s.id, s.full_name
      into v_staff_id, v_staff_name
    from public.staff s
    where s.auth_user_id = v_uid
      and s.is_active = true
    limit 1;

    if v_staff_id is null then
      raise exception 'No active Staff profile is linked to this account';
    end if;
  end if;

  insert into public.staff_activity_logs (staff_id, staff_name, action, details)
  values (
    v_staff_id,
    coalesce(nullif(btrim(v_staff_name), ''), 'Staff'),
    btrim(p_action),
    nullif(btrim(p_details), '')
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.record_staff_activity(text, text) from public;
revoke all on function public.record_staff_activity(text, text) from anon;
grant execute on function public.record_staff_activity(text, text) to authenticated;
