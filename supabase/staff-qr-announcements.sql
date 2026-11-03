-- Public, read-only feed for active staff notices shown after QR check-in.
-- Only currently active announcement text is exposed; admin writes remain protected
-- by the existing staff_announcements table policies.
create or replace function public.staff_qr_active_announcements()
returns table (
  title text,
  message text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.title::text, a.message::text
  from public.staff_announcements as a
  where a.is_active is true
    and (a.starts_at is null or a.starts_at <= now())
    and (a.ends_at is null or a.ends_at > now())
  order by a.starts_at desc nulls last, a.created_at desc
  limit 10;
$$;

revoke all on function public.staff_qr_active_announcements() from public;
grant execute on function public.staff_qr_active_announcements() to anon, authenticated;
