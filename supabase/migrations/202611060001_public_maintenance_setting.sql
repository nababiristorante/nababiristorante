-- Allow anonymous visitors to read only the public maintenance flag.
drop policy if exists "Public can read website maintenance flag" on public.site_settings;
create policy "Public can read website maintenance flag"
on public.site_settings for select to anon, authenticated
using (setting_key = 'website_maintenance_mode');
