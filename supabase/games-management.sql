-- NABABI RISTORANTE: Games Management schema extension
-- Safe to run more than once. Existing games and their current enabled state are preserved.

alter table public.games
  add column if not exists description text,
  add column if not exists reward_type text not null default 'none',
  add column if not exists reward_value numeric(10,2),
  add column if not exists reward_label text,
  add column if not exists max_claims integer,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.games
  drop constraint if exists games_reward_type_check;
alter table public.games
  add constraint games_reward_type_check
  check (reward_type in ('none','discount_percent','discount_euro','free_food','free_drink','custom'));

alter table public.games
  drop constraint if exists games_reward_value_check;
alter table public.games
  add constraint games_reward_value_check
  check (reward_value is null or reward_value >= 0);

alter table public.games
  drop constraint if exists games_max_claims_check;
alter table public.games
  add constraint games_max_claims_check
  check (max_claims is null or max_claims > 0);

alter table public.games
  drop constraint if exists games_validity_window_check;
alter table public.games
  add constraint games_validity_window_check
  check (starts_at is null or ends_at is null or ends_at > starts_at);

create index if not exists games_public_enabled_idx
  on public.games (is_enabled, starts_at, ends_at);

-- Claims are written only by a trusted server-side function using the service role.
-- No anon/authenticated INSERT, UPDATE or DELETE policy is created here.
create table if not exists public.game_claims (
  id uuid primary key default gen_random_uuid(),
  game_key text not null,
  claim_code text not null unique,
  reward_type text not null,
  reward_value numeric(10,2),
  reward_label text,
  visitor_hash text,
  status text not null default 'issued',
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint game_claims_status_check check (status in ('issued','redeemed','expired','revoked'))
);

create index if not exists game_claims_game_created_idx
  on public.game_claims (game_key, created_at desc);
create index if not exists game_claims_status_expiry_idx
  on public.game_claims (status, expires_at);

alter table public.game_claims enable row level security;
revoke all on public.game_claims from anon, authenticated;
grant all on public.game_claims to service_role;
