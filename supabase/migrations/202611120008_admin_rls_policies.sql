-- NABABI: additive RLS policies for authenticated Admin Panel access.
-- Admin identity is resolved from public.admin_users.user_id = auth.uid(),
-- matching assets/js/admin-v2.js authorize(). No client-supplied role is trusted.
-- This migration deliberately does not create missing business tables or grant
-- anonymous access to customer/attendance data.

do $$
declare
  t text;
begin
  -- Admin-only read/write access to website settings. Public visitors receive
  -- read access only to the explicitly public homepage setting keys below.
  if to_regclass('public.site_settings') is not null then
    execute 'alter table public.site_settings enable row level security';
    execute 'drop policy if exists nababi_public_read_homepage_settings on public.site_settings';
    execute $p$create policy nababi_public_read_homepage_settings
      on public.site_settings for select to anon, authenticated
      using (setting_key in (
        'website_maintenance_mode',
        'restaurant_logo_url',
        'homepage_background_url',
        'about_image_url','about_video_url','about_title','about_text',
        'about_title_it','about_title_en','about_title_bn',
        'about_text_it','about_text_en','about_text_bn',
        'about_heading','about_description',
        'homepage_about_title','homepage_about_text','homepage_about_image_url'
      ))$p$;
    execute 'drop policy if exists nababi_admin_manage_site_settings on public.site_settings';
    execute $p$create policy nababi_admin_manage_site_settings
      on public.site_settings for all to authenticated
      using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
      with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))$p$;
    grant select on public.site_settings to anon, authenticated;
    grant insert, update, delete on public.site_settings to authenticated;
  end if;

  -- Admin CRUD for floor-plan tables. Public users retain active-table read
  -- access, but cannot create/edit/delete floor-plan records.
  if to_regclass('public.booking_floor_tables') is not null then
    execute 'alter table public.booking_floor_tables enable row level security';
    execute 'drop policy if exists nababi_admin_manage_floor_tables on public.booking_floor_tables';
    execute $p$create policy nababi_admin_manage_floor_tables
      on public.booking_floor_tables for all to authenticated
      using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
      with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))$p$;
    grant select on public.booking_floor_tables to anon, authenticated;
    grant insert, update, delete on public.booking_floor_tables to authenticated;
  end if;

  -- Admin review/contact moderation. No public SELECT is introduced.
  foreach t in array array['contact_messages','reviews'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists nababi_admin_read_%I on public.%I', t, t);
      execute format('create policy nababi_admin_read_%I on public.%I for select to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))', t, t);
      execute format('drop policy if exists nababi_admin_update_%I on public.%I', t, t);
      execute format('create policy nababi_admin_update_%I on public.%I for update to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid())) with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))', t, t);
      execute format('grant select, update on table public.%I to authenticated', t);
    end if;
  end loop;

  -- Admin can read attendance event history used by weekly reports.
  if to_regclass('public.staff_attendance_events') is not null then
    execute 'alter table public.staff_attendance_events enable row level security';
    execute 'drop policy if exists nababi_admin_read_attendance_events on public.staff_attendance_events';
    execute $p$create policy nababi_admin_read_attendance_events
      on public.staff_attendance_events for select to authenticated
      using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))$p$;
    grant select on public.staff_attendance_events to authenticated;
  end if;

  -- Admin booking management. Existing public booking insertion and safe
  -- status-lookup RPCs are intentionally left unchanged.
  if to_regclass('public.bookings') is not null then
    execute 'alter table public.bookings enable row level security';
    execute 'drop policy if exists nababi_admin_read_bookings on public.bookings';
    execute $p$create policy nababi_admin_read_bookings
      on public.bookings for select to authenticated
      using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))$p$;
    execute 'drop policy if exists nababi_admin_update_bookings on public.bookings';
    execute $p$create policy nababi_admin_update_bookings
      on public.bookings for update to authenticated
      using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
      with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))$p$;
    grant select, update on public.bookings to authenticated;
  end if;
end
$$;
