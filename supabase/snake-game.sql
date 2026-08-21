-- Run this entire file once in Supabase SQL Editor.
create table if not exists public.snake_game_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  best_score integer not null default 0 check (best_score between 0 and 1000000),
  updated_at timestamptz not null default now()
);

create table if not exists public.snake_game_guest_scores (
  guest_token text primary key,
  display_name text not null,
  best_score integer not null default 0 check (best_score between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.snake_game_scores enable row level security;
alter table public.snake_game_guest_scores enable row level security;
grant select on public.snake_game_scores, public.snake_game_guest_scores to anon, authenticated;

drop policy if exists "snake scores readable" on public.snake_game_scores;
drop policy if exists "snake guests readable" on public.snake_game_guest_scores;
create policy "snake scores readable" on public.snake_game_scores for select using (true);
create policy "snake guests readable" on public.snake_game_guest_scores for select using (true);

create or replace function public.submit_snake_game_score(p_score integer)
returns table(out_best_score integer)
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '请先登录'; end if;
  if p_score is null or p_score < 0 or p_score > 1000000 then raise exception '无效的游戏分数'; end if;
  insert into public.snake_game_scores(user_id, best_score, updated_at)
  values(v_uid, p_score, now())
  on conflict(user_id) do update set
    best_score = greatest(public.snake_game_scores.best_score, excluded.best_score),
    updated_at = case when excluded.best_score > public.snake_game_scores.best_score then now() else public.snake_game_scores.updated_at end;
  return query select s.best_score from public.snake_game_scores s where s.user_id = v_uid;
end;
$$;

create or replace function public.set_guest_snake_nickname(p_guest_token text, p_nickname text)
returns table(out_display_name text, out_best_score integer)
language plpgsql security definer set search_path = public
as $$
declare v_name text := left(trim(coalesce(p_nickname, '')), 20);
begin
  if length(trim(coalesce(p_guest_token, ''))) < 8 then raise exception '游客标识无效'; end if;
  if v_name = '' then raise exception '请输入昵称'; end if;
  insert into public.snake_game_guest_scores(guest_token, display_name, best_score, created_at, updated_at)
  values(p_guest_token, v_name, 0, now(), now())
  on conflict(guest_token) do update set display_name = excluded.display_name;
  return query select g.display_name, g.best_score from public.snake_game_guest_scores g where g.guest_token = p_guest_token;
end;
$$;

create or replace function public.submit_guest_snake_game_score(p_guest_token text, p_score integer)
returns table(out_display_name text, out_best_score integer)
language plpgsql security definer set search_path = public
as $$
begin
  if p_score is null or p_score < 0 or p_score > 1000000 then raise exception '无效的游戏分数'; end if;
  update public.snake_game_guest_scores g set
    best_score = greatest(g.best_score, p_score),
    updated_at = case when p_score > g.best_score then now() else g.updated_at end
  where g.guest_token = p_guest_token;
  if not found then raise exception '请先填写上榜昵称'; end if;
  return query select g.display_name, g.best_score from public.snake_game_guest_scores g where g.guest_token = p_guest_token;
end;
$$;

create or replace function public.list_snake_game_leaderboard(p_limit integer default 50)
returns table(out_player_key text, out_display_name text, out_avatar_url text, out_best_score integer, out_is_guest boolean)
language sql stable security definer set search_path = public
as $$
  select ranked.player_key, ranked.display_name, ranked.avatar_url, ranked.best_score, ranked.is_guest
  from (
    select 'user:' || s.user_id::text as player_key,
      coalesce(nullif(p.display_name, ''), '普通用户') as display_name,
      p.avatar_url, s.best_score, false as is_guest
    from public.snake_game_scores s left join public.profiles p on p.id = s.user_id
    union all
    select 'guest:' || g.guest_token, g.display_name, null::text, g.best_score, true
    from public.snake_game_guest_scores g
  ) ranked
  order by ranked.best_score desc, ranked.display_name asc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.delete_guest_snake_score(p_guest_token text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_blog_admin() then raise exception '仅管理员可以删除榜单记录'; end if;
  delete from public.snake_game_guest_scores where guest_token = p_guest_token;
end;
$$;

revoke all on function public.submit_snake_game_score(integer) from public;
revoke all on function public.set_guest_snake_nickname(text, text) from public;
revoke all on function public.submit_guest_snake_game_score(text, integer) from public;
revoke all on function public.list_snake_game_leaderboard(integer) from public;
revoke all on function public.delete_guest_snake_score(text) from public;
grant execute on function public.submit_snake_game_score(integer) to authenticated;
grant execute on function public.set_guest_snake_nickname(text, text) to anon, authenticated;
grant execute on function public.submit_guest_snake_game_score(text, integer) to anon, authenticated;
grant execute on function public.list_snake_game_leaderboard(integer) to anon, authenticated;
grant execute on function public.delete_guest_snake_score(text) to authenticated;
