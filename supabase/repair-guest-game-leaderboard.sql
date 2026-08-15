-- Run this small file once in Supabase SQL Editor.
-- It is independent from the activity-system migration and is safe to rerun.
create table if not exists public.jump_game_guest_scores (
  guest_token text primary key check (char_length(guest_token) between 20 and 100),
  display_name text not null unique,
  best_score integer not null default 0 check (best_score between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jump_game_guest_scores enable row level security;
grant select on public.jump_game_guest_scores to anon, authenticated;
drop policy if exists "guest jump scores are readable" on public.jump_game_guest_scores;
create policy "guest jump scores are readable" on public.jump_game_guest_scores for select using (true);

create or replace function public.submit_guest_jump_game_score(p_guest_token text, p_score integer)
returns table(guest_token text, display_name text, best_score integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare next_name text;
begin
  if p_guest_token is null or char_length(p_guest_token) < 20 or char_length(p_guest_token) > 100 then raise exception '游客身份无效'; end if;
  if p_score is null or p_score < 0 or p_score > 1000000 then raise exception '无效的游戏分数'; end if;
  select g.display_name into next_name from public.jump_game_guest_scores g where g.guest_token = p_guest_token;
  if next_name is null then
    select '罗星人' || (coalesce(max(nullif(regexp_replace(g.display_name, '\D', '', 'g'), '')::integer), 0) + 1)::text
    into next_name from public.jump_game_guest_scores g;
  end if;
  insert into public.jump_game_guest_scores as current_score (guest_token, display_name, best_score, updated_at)
  values (p_guest_token, next_name, p_score, now())
  on conflict on constraint jump_game_guest_scores_pkey do update
  set best_score = greatest(current_score.best_score, excluded.best_score),
      updated_at = case when excluded.best_score > current_score.best_score then now() else current_score.updated_at end;
  return query select g.guest_token, g.display_name, g.best_score from public.jump_game_guest_scores g where g.guest_token = p_guest_token;
end;
$$;

create or replace function public.list_jump_game_leaderboard(p_limit integer default 20)
returns table(player_key text, display_name text, avatar_url text, best_score integer, is_guest boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select ranked.player_key, ranked.display_name, ranked.avatar_url, ranked.best_score, ranked.is_guest
  from (
    select 'user:' || s.user_id::text, coalesce(nullif(p.display_name, ''), '普通用户'), p.avatar_url, s.best_score, false
    from public.jump_game_scores s left join public.profiles p on p.id = s.user_id
    union all
    select 'guest:' || g.guest_token, g.display_name, null::text, g.best_score, true
    from public.jump_game_guest_scores g
  ) as ranked(player_key, display_name, avatar_url, best_score, is_guest)
  order by ranked.best_score desc, ranked.display_name asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.submit_guest_jump_game_score(text, integer) from public;
revoke all on function public.list_jump_game_leaderboard(integer) from public;
grant execute on function public.submit_guest_jump_game_score(text, integer) to anon, authenticated;
grant execute on function public.list_jump_game_leaderboard(integer) to anon, authenticated;
