-- NABABI cash drawer: manually recorded banknote movements and daily totals.
create table if not exists public.cash_drawer_entries (
 id uuid primary key default gen_random_uuid(),
 direction text not null check (direction in ('in','out')),
 denomination integer not null check (denomination in (5,10,20,50,100,200,500)),
 quantity integer not null check (quantity between 1 and 10000),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index if not exists cash_drawer_entries_created_at_idx on public.cash_drawer_entries(created_at desc);
alter table public.cash_drawer_entries enable row level security;
drop policy if exists nababi_admin_read_cash_drawer on public.cash_drawer_entries;
create policy nababi_admin_read_cash_drawer on public.cash_drawer_entries for select to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
drop policy if exists nababi_admin_insert_cash_drawer on public.cash_drawer_entries;
create policy nababi_admin_insert_cash_drawer on public.cash_drawer_entries for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
grant select, insert on public.cash_drawer_entries to authenticated;
