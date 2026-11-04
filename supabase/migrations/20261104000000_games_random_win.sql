-- Nababi Games: 10% default random win probability.
-- Existing games are set to 10%; admins can adjust this value in the Admin Panel.
alter table public.nababi_games
  alter column win_probability set default 10;

-- Existing per-game probabilities are preserved; only the column default changes.
-- Remove answer-based forced wins: all games use the configured random probability.
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
set search_path = ''
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

  v_random := extensions.gen_random_bytes(4);
  v_won := (
    (
      get_byte(v_random, 0)::bigint * 16777216 +
      get_byte(v_random, 1)::bigint * 65536 +
      get_byte(v_random, 2)::bigint * 256 +
      get_byte(v_random, 3)::bigint
    ) % 10000
  ) < round(coalesce(v_game.win_probability, 10) * 100)::bigint;

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

alter function public.play_game_and_issue_claim(text,text,text)
  set search_path = '';

revoke all on function public.play_game_and_issue_claim(text,text,text)
  from public, anon, authenticated;
grant execute on function public.play_game_and_issue_claim(text,text,text)
  to service_role;

-- Also harden the other privileged RPCs created by games-management.sql.
alter function public.issue_game_claim(text,text,text) set search_path = '';
alter function public.redeem_game_claim(text) set search_path = '';
