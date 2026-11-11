-- Public homepage submissions and table availability.
-- Idempotent migration; customer PII is never returned by the availability RPC.

create extension if not exists pgcrypto;

create table if not exists public.booking_floor_tables (
  id uuid primary key default gen_random_uuid(),
  table_code text not null unique,
  room_name text not null,
  seats integer not null check (seats between 1 and 30),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.booking_floor_tables (table_code, room_name, seats, display_order)
values
  ('SP-01','Sala Principale',6,1),('SP-02','Sala Principale',6,2),
  ('SP-03','Sala Principale',6,3),('SP-04','Sala Principale',6,4),
  ('SP-05','Sala Principale',6,5),('SP-06','Sala Principale',6,6),
  ('SF-01','Sala dei Fiori',2,7),('SF-02','Sala dei Fiori',2,8),
  ('SF-16','Sala dei Fiori',16,9),('DH-01','Dehors',2,10),
  ('DH-02','Dehors',2,11),('DH-03','Dehors',6,12),
  ('DH-04','Dehors',6,13),('DH-05','Dehors',6,14)
on conflict (table_code) do update set
  room_name = excluded.room_name,
  seats = excluded.seats,
  display_order = excluded.display_order;

alter table public.bookings
  add column if not exists selected_table_id uuid
    references public.booking_floor_tables(id),
  add column if not exists booking_code text;

create unique index if not exists bookings_booking_code_uidx
  on public.bookings (booking_code)
  where booking_code is not null;

create unique index if not exists bookings_table_slot_uidx
  on public.bookings (booking_date, booking_time, selected_table_id)
  where selected_table_id is not null
    and coalesce(lower(status::text), '') <> 'cancelled';

create or replace function public.nababi_assign_booking_code()
returns trigger
language plpgsql
as $$
begin
  if new.booking_code is null or btrim(new.booking_code) = '' then
    new.booking_code := 'NAB-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 12));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_nababi_booking_code on public.bookings;
create trigger trg_nababi_booking_code
before insert on public.bookings
for each row execute function public.nababi_assign_booking_code();

alter table public.booking_floor_tables enable row level security;
drop policy if exists "Public can view active Nababi floor tables" on public.booking_floor_tables;
create policy "Public can view active Nababi floor tables"
  on public.booking_floor_tables for select to anon, authenticated
  using (is_active = true);
grant select on public.booking_floor_tables to anon, authenticated;

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
