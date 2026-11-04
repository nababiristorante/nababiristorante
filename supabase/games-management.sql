-- NABABI RISTORANTE: Games Management schema extension
-- Safe to run more than once. Existing games and their current enabled state are preserved.

alter table public.nababi_games
  add column if not exists description text,
  add column if not exists reward_type text not null default 'none',
  add column if not exists reward_value numeric(10,2),
  add column if not exists reward_label text,
  add column if not exists max_claims integer,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.nababi_games
  drop constraint if exists games_reward_type_check;
alter table public.nababi_games
  add constraint games_reward_type_check
  check (reward_type in ('none','discount_percent','discount_euro','free_food','free_drink','custom'));

alter table public.nababi_games
  drop constraint if exists games_reward_value_check;
alter table public.nababi_games
  add constraint games_reward_value_check
  check (reward_value is null or reward_value >= 0);

alter table public.nababi_games
  drop constraint if exists games_max_claims_check;
alter table public.nababi_games
  add constraint games_max_claims_check
  check (max_claims is null or max_claims > 0);

alter table public.nababi_games
  drop constraint if exists games_validity_window_check;
alter table public.nababi_games
  add constraint games_validity_window_check
  check (starts_at is null or ends_at is null or ends_at > starts_at);

create index if not exists games_public_enabled_idx
  on public.nababi_games (is_enabled, starts_at, ends_at);

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


-- Store only keyed hashes of customer identifiers; never store raw phone numbers.
alter table public.game_claims
  add column if not exists phone_hash text;

create unique index if not exists game_claims_game_phone_unique
  on public.game_claims (game_key, phone_hash)
  where phone_hash is not null;

create unique index if not exists game_claims_game_visitor_unique
  on public.game_claims (game_key, visitor_hash)
  where visitor_hash is not null;

-- Atomically validates the game, enforces limits and issues one unique coupon.
-- This function is callable only by the Edge Function using the service role.
create or replace function public.issue_game_claim(
  p_game_key text,
  p_phone_hash text,
  p_visitor_hash text
)
returns table (
  success boolean,
  claim_code text,
  reward_type text,
  reward_value numeric,
  reward_label text,
  expires_at timestamptz,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.nababi_games%rowtype;
  v_claim_count integer;
  v_code text;
  v_expiry timestamptz;
begin
  if p_game_key is null or length(p_game_key) > 80
     or (p_phone_hash is not null and length(p_phone_hash) <> 64)
     or p_visitor_hash is null or length(p_visitor_hash) <> 64 then
    return query select false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'Invalid claim details';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_game_key));

  select * into v_game
  from public.nababi_games
  where game_key = p_game_key
  for share;

  if not found or v_game.is_enabled is distinct from true
     or (v_game.starts_at is not null and v_game.starts_at > now())
     or (v_game.ends_at is not null and v_game.ends_at < now())
     or coalesce(v_game.reward_type, 'none') = 'none' then
    return query select false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'Game or reward is not available';
    return;
  end if;

  if exists (
    select 1 from public.game_claims
    where game_key = p_game_key
      and ((p_phone_hash is not null and phone_hash = p_phone_hash)
        or visitor_hash = p_visitor_hash)
  ) then
    return query select false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'A reward was already claimed for this game';
    return;
  end if;

  select count(*)::integer into v_claim_count
  from public.game_claims
  where game_key = p_game_key and status in ('issued','redeemed');

  if v_game.max_claims is not null and v_claim_count >= v_game.max_claims then
    return query select false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'No rewards remaining';
    return;
  end if;

  v_code := 'NBG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_expiry := coalesce(v_game.ends_at, now() + interval '30 days');

  insert into public.game_claims (
    game_key, claim_code, reward_type, reward_value, reward_label,
    phone_hash, visitor_hash, status, expires_at
  ) values (
    p_game_key, v_code, v_game.reward_type, v_game.reward_value,
    v_game.reward_label, p_phone_hash, p_visitor_hash, 'issued', v_expiry
  );

  return query select true, v_code, v_game.reward_type,
    v_game.reward_value, v_game.reward_label, v_expiry, null::text;
end;
$$;

revoke all on function public.issue_game_claim(text,text,text) from public, anon, authenticated;
grant execute on function public.issue_game_claim(text,text,text) to service_role;


-- One anonymous play per browser token and game. No customer phone or login is required.
alter table public.nababi_games
  add column if not exists win_probability numeric(5,2) not null default 10;

alter table public.nababi_games
  drop constraint if exists games_win_probability_check;
alter table public.nababi_games
  add constraint games_win_probability_check
  check (win_probability >= 0 and win_probability <= 100);

create table if not exists public.game_play_attempts (
  id uuid primary key default gen_random_uuid(),
  game_key text not null,
  visitor_hash text not null,
  won boolean not null,
  created_at timestamptz not null default now(),
  constraint game_play_attempts_one_per_visitor unique (game_key, visitor_hash)
);

alter table public.game_play_attempts enable row level security;
revoke all on public.game_play_attempts from anon, authenticated;
grant all on public.game_play_attempts to service_role;

create or replace function public.play_game_and_issue_claim(
  p_game_key text,
  p_visitor_hash text,
  p_choice text
)
returns table (
  won boolean,
  success boolean,
  claim_code text,
  reward_type text,
  reward_value numeric,
  reward_label text,
  expires_at timestamptz,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.nababi_games%rowtype;
  v_claim_count integer;
  v_won boolean;
  v_code text;
  v_expiry timestamptz;
  v_random bytea;
begin
  if p_game_key is null or length(p_game_key) > 80
     or p_visitor_hash is null or length(p_visitor_hash) <> 64 then
    return query select false, false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'Invalid play details';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_game_key));

  select * into v_game
  from public.nababi_games
  where game_key = p_game_key
  for share;

  if not found or v_game.is_enabled is distinct from true
     or (v_game.starts_at is not null and v_game.starts_at > now())
     or (v_game.ends_at is not null and v_game.ends_at < now())
     or coalesce(v_game.reward_type, 'none') = 'none' then
    return query select false, false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'Game or reward is not available';
    return;
  end if;

  if exists (
    select 1 from public.game_play_attempts
    where game_key = p_game_key and visitor_hash = p_visitor_hash
  ) then
    return query select false, false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'You have already played this game';
    return;
  end if;

  select count(*)::integer into v_claim_count
  from public.game_claims
  where game_key = p_game_key and status in ('issued','redeemed');

  if v_game.max_claims is not null and v_claim_count >= v_game.max_claims then
    return query select false, false, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'No rewards remaining';
    return;
  end if;

  v_random := gen_random_bytes(4);
  v_won := (
    (
      get_byte(v_random, 0)::bigint * 16777216 +
      get_byte(v_random, 1)::bigint * 65536 +
      get_byte(v_random, 2)::bigint * 256 +
      get_byte(v_random, 3)::bigint
    ) % 10000
  ) < round(coalesce(v_game.win_probability, 20) * 100)::bigint;

  if p_game_key = 'find_golden_n' then
    v_won := upper(coalesce(p_choice, '')) = 'N';
  elsif p_game_key = 'food_quiz' then
    v_won := lower(coalesce(p_choice, '')) = 'biryani';
  end if;

  insert into public.game_play_attempts(game_key, visitor_hash, won)
  values (p_game_key, p_visitor_hash, v_won);

  if not v_won then
    return query select false, true, null::text, null::text, null::numeric,
      null::text, null::timestamptz, 'Not a winner this time. Thanks for playing!';
    return;
  end if;

  v_code := 'NBG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_expiry := coalesce(v_game.ends_at, now() + interval '30 days');

  insert into public.game_claims (
    game_key, claim_code, reward_type, reward_value, reward_label,
    visitor_hash, status, expires_at
  ) values (
    p_game_key, v_code, v_game.reward_type, v_game.reward_value,
    v_game.reward_label, p_visitor_hash, 'issued', v_expiry
  );

  return query select true, true, v_code, v_game.reward_type,
    v_game.reward_value, v_game.reward_label, v_expiry, null::text;
end;
$$;

revoke all on function public.play_game_and_issue_claim(text,text,text) from public, anon, authenticated;
grant execute on function public.play_game_and_issue_claim(text,text,text) to service_role;


-- Redeem a coupon once, only through the authenticated staff Edge Function.
create or replace function public.redeem_game_claim(p_claim_code text)
returns table (
  success boolean,
  message text,
  game_key text,
  reward_label text,
  redeemed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.game_claims%rowtype;
begin
  if p_claim_code is null or length(p_claim_code) > 40 then
    return query select false, 'Invalid coupon code', null::text, null::text, null::timestamptz;
    return;
  end if;

  select * into v_claim
  from public.game_claims
  where upper(claim_code) = upper(trim(p_claim_code))
  for update;

  if not found then
    return query select false, 'Coupon code not found', null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_claim.status <> 'issued' then
    return query select false, 'Coupon has already been used or is no longer valid',
      v_claim.game_key, v_claim.reward_label, v_claim.redeemed_at;
    return;
  end if;

  if v_claim.expires_at is not null and v_claim.expires_at < now() then
    update public.game_claims set status = 'expired' where id = v_claim.id;
    return query select false, 'Coupon has expired', v_claim.game_key,
      v_claim.reward_label, null::timestamptz;
    return;
  end if;

  update public.game_claims
  set status = 'redeemed', redeemed_at = now()
  where id = v_claim.id;

  return query select true, 'Coupon successfully redeemed', v_claim.game_key,
    v_claim.reward_label, now();
end;
$$;

revoke all on function public.redeem_game_claim(text) from public, anon, authenticated;
grant execute on function public.redeem_game_claim(text) to service_role;


-- Harden all privileged RPCs against search_path object shadowing.
alter function public.issue_game_claim(text,text,text) set search_path = '';
alter function public.play_game_and_issue_claim(text,text,text) set search_path = '';
alter function public.redeem_game_claim(text) set search_path = '';
