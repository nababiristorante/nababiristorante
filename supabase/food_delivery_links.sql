-- Nababi Ristorante: controlli dei link Food Delivery
create table if not exists public.food_delivery_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.food_delivery_links enable row level security;

drop policy if exists "Public can view active food delivery links" on public.food_delivery_links;
create policy "Public can view active food delivery links"
on public.food_delivery_links for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage food delivery links" on public.food_delivery_links;
create policy "Admins can manage food delivery links"
on public.food_delivery_links for all
to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
)
with check (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);
