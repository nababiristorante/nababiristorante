-- Nababi Ristorante: floor plan and table booking foundation
-- Run this file in Supabase SQL Editor. Safe to run more than once.

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

insert into public.booking_floor_tables
  (table_code, room_name, seats, display_order)
values
  ('SP-01','Sala Principale',6,1),
  ('SP-02','Sala Principale',6,2),
  ('SP-03','Sala Principale',6,3),
  ('SP-04','Sala Principale',6,4),
  ('SP-05','Sala Principale',6,5),
  ('SP-06','Sala Principale',6,6),
  ('SF-01','Sala dei Fiori',2,7),
  ('SF-02','Sala dei Fiori',2,8),
  ('SF-16','Sala dei Fiori',16,9),
  ('DH-01','Dehors',2,10),
  ('DH-02','Dehors',2,11),
  ('DH-03','Dehors',6,12),
  ('DH-04','Dehors',6,13),
  ('DH-05','Dehors',6,14)
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

-- A table can have only one active booking for the same exact date and time.
-- Cancelled bookings do not block the table.
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

drop policy if exists "Public can view active Nababi floor tables"
  on public.booking_floor_tables;
create policy "Public can view active Nababi floor tables"
  on public.booking_floor_tables
  for select to anon, authenticated
  using (is_active = true);

grant select on public.booking_floor_tables to anon, authenticated;


-- Public availability: exposes only table identifiers and free/busy state,
-- never customer names or contact details.
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

-- Public booking status lookup by the high-entropy booking code.
-- Returns booking details needed by the customer, never name, phone, email or notes.
create or replace function public.nababi_lookup_booking_status(p_booking_code text)
returns table (
  booking_code text,
  booking_date date,
  booking_time time,
  guests integer,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.booking_code,
    b.booking_date,
    b.booking_time,
    b.guests,
    b.status::text
  from public.bookings b
  where p_booking_code is not null
    and length(btrim(p_booking_code)) between 8 and 20
    and upper(btrim(b.booking_code)) = upper(btrim(p_booking_code))
  limit 1;
$$;

revoke all on function public.nababi_lookup_booking_status(text) from public;
grant execute on function public.nababi_lookup_booking_status(text) to anon, authenticated;
