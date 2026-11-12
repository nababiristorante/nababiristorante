-- Keep the Admin Customers module in sync with public and Admin bookings.
-- Customer contact data remains available only to authenticated Admin users.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.customers enable row level security;

drop policy if exists "Admins manage customers" on public.customers;
create policy "Admins manage customers"
  on public.customers
  for all
  to authenticated
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

grant select, insert, update, delete on public.customers to authenticated;

create or replace function public.nababi_sync_booking_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_customer_id text;
  customer_name text;
  customer_phone text;
  customer_email text;
begin
  customer_name := nullif(btrim(coalesce(new.full_name, '')), '');
  customer_phone := nullif(btrim(coalesce(new.phone, '')), '');
  customer_email := nullif(lower(btrim(coalesce(new.email, ''))), '');

  if customer_name is null then
    return new;
  end if;

  if customer_phone is not null then
    select c.id::text into matched_customer_id
    from public.customers c
    where regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') =
          regexp_replace(customer_phone, '[^0-9]', '', 'g')
      and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') <> ''
    order by c.created_at asc
    limit 1
    for update;
  end if;

  if matched_customer_id is null and customer_email is not null then
    select c.id into matched_customer_id
    from public.customers c
    where lower(coalesce(c.email, '')) = customer_email
    order by c.created_at asc
    limit 1
    for update;
  end if;

  if matched_customer_id is null then
    insert into public.customers (full_name, phone, email, created_at, updated_at)
    values (customer_name, customer_phone, customer_email, now(), now());
  else
    update public.customers
    set full_name = customer_name,
        phone = coalesce(customer_phone, phone),
        email = coalesce(customer_email, email),
        updated_at = now()
    where id::text = matched_customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_nababi_sync_booking_customer on public.bookings;
create trigger trg_nababi_sync_booking_customer
after insert or update of full_name, phone, email
on public.bookings
for each row
execute function public.nababi_sync_booking_customer();
