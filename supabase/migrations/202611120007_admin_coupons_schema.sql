-- Backing table for the Admin V2 Coupons CRUD module.
-- Customer reward coupons are separately handled by the existing coupon RPC flow.

create extension if not exists pgcrypto;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent integer not null check (discount_percent between 1 and 100),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.coupons
  add column if not exists code text,
  add column if not exists discount_percent integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.coupons enable row level security;

drop policy if exists "Admins manage coupons" on public.coupons;
create policy "Admins manage coupons"
  on public.coupons
  for all
  to authenticated
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

grant select, insert, update, delete on public.coupons to authenticated;
