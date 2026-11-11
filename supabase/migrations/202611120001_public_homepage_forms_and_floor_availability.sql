-- Public homepage submissions and table availability.
-- Idempotent migration; customer PII is never returned by the availability RPC.

create or replace function public.nababi_available_floor_tables(
  p_date date,
  p_time time
)
returns table (
  id uuid,
  table_code text,
  room_name text,
  seats integer,
  is_available boolean
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    t.table_code,
    t.room_name,
    t.seats,
    not exists (
      select 1
      from public.bookings b
      where b.selected_table_id = t.id
        and b.booking_date = p_date
        and b.booking_time = p_time
        and coalesce(lower(b.status::text), '') <> 'cancelled'
    ) as is_available
  from public.booking_floor_tables t
  where t.is_active = true
  order by t.display_order;
$$;

revoke all on function public.nababi_available_floor_tables(date,time) from public;
grant execute on function public.nababi_available_floor_tables(date,time) to anon, authenticated;

-- Contact form: visitors may submit messages but cannot read or modify them.
alter table public.contact_messages enable row level security;
grant insert on table public.contact_messages to anon;

drop policy if exists "Public can submit contact messages" on public.contact_messages;
create policy "Public can submit contact messages"
on public.contact_messages
for insert
to anon
with check (
  char_length(trim(full_name)) between 2 and 120
  and (email is null or char_length(trim(email)) <= 254)
  and (phone is null or char_length(trim(phone)) <= 40)
  and (subject is null or char_length(trim(subject)) <= 180)
  and char_length(trim(message)) between 3 and 4000
  and coalesce(is_read, false) = false
);

-- Reviews are submitted pending moderation; only Admin can approve them.
alter table public.reviews enable row level security;
grant insert on table public.reviews to anon;

drop policy if exists "Public can submit pending reviews" on public.reviews;
create policy "Public can submit pending reviews"
on public.reviews
for insert
to anon
with check (
  is_approved = false
  and char_length(trim(customer_name)) between 2 and 120
  and rating between 1 and 5
  and char_length(trim(review_text)) between 5 and 3000
);
