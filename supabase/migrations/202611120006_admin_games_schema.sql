-- Ensure the Admin V2 Games Management module has its backing table.
-- Game configuration is private to registered Admin users.

create table if not exists public.nababi_games (
  game_key text primary key check (
    game_key in ('find_golden_n','food_quiz','mystery_gift','scratch_win','spin_win')
  ),
  title text not null,
  image_url text,
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.nababi_games
  add column if not exists title text,
  add column if not exists image_url text,
  add column if not exists is_enabled boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

insert into public.nababi_games (game_key, title, is_enabled)
values
  ('find_golden_n','Find the Golden N',false),
  ('food_quiz','Food Quiz',false),
  ('mystery_gift','Mystery Gift',false),
  ('scratch_win','Scratch & Win',false),
  ('spin_win','Spin & Win',false)
on conflict (game_key) do nothing;

alter table public.nababi_games enable row level security;

drop policy if exists "Admins manage Nababi games" on public.nababi_games;
create policy "Admins manage Nababi games"
  on public.nababi_games
  for all
  to authenticated
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

grant select, insert, update, delete on public.nababi_games to authenticated;
