-- ============================================================
-- 完整修复：column reference "display_name" is ambiguous
-- 原因：函数 RETURNS TABLE 的输出列名在函数体内可见，
--       SQL 中未加表名前缀的列名与 OUT 参数产生歧义。
-- 修复：所有引用列的地方都加表别名前缀。
-- 在 Supabase SQL Editor 中运行一次即可。
-- ============================================================

-- 1. 修复 set_guest_nickname：WHERE 中的 display_name 加表别名前缀
create or replace function public.set_guest_nickname(p_guest_token text, p_nickname text)
returns table(guest_token text, display_name text, best_score integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_name text;
begin
  if p_guest_token is null or char_length(p_guest_token) < 20 or char_length(p_guest_token) > 100 then
    raise exception '游客身份无效';
  end if;
  clean_name := btrim(coalesce(p_nickname, ''));
  if char_length(clean_name) < 1 or char_length(clean_name) > 20 then
    raise exception '昵称长度需在1-20个字符之间';
  end if;
  if exists (
    select 1 from public.jump_game_guest_scores g
    where g.display_name = clean_name and g.guest_token != p_guest_token
  ) then
    raise exception '这个昵称已经被占用了，换一个吧';
  end if;
  insert into public.jump_game_guest_scores as ins
    (guest_token, display_name, best_score, created_at, updated_at)
  values
    (p_guest_token, clean_name, 0, now(), now())
  on conflict (guest_token) do update
    set display_name = excluded.display_name, updated_at = now();
  return query
    select g.guest_token, g.display_name, g.best_score
    from public.jump_game_guest_scores g
    where g.guest_token = p_guest_token;
end;
$$;

-- 2. 修复 submit_guest_jump_game_score：UPDATE 中的 best_score 加别名前缀
create or replace function public.submit_guest_jump_game_score(p_guest_token text, p_score integer)
returns table(guest_token text, display_name text, best_score integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_guest_token is null or char_length(p_guest_token) < 20 or char_length(p_guest_token) > 100 then
    raise exception '游客身份无效';
  end if;
  if p_score is null or p_score < 0 or p_score > 1000000 then
    raise exception '无效的游戏分数';
  end if;
  update public.jump_game_guest_scores as upd
  set best_score = greatest(upd.best_score, p_score),
      updated_at = case when p_score > upd.best_score then now() else upd.updated_at end
  where upd.guest_token = p_guest_token;

  return query
    select g.guest_token, g.display_name, g.best_score
    from public.jump_game_guest_scores g
    where g.guest_token = p_guest_token;
end;
$$;

-- 3. 修复 list_jump_game_leaderboard：所有列引用加 ranked. 前缀
create or replace function public.list_jump_game_leaderboard(p_limit integer default 50)
returns table(
  player_key text,
  display_name text,
  avatar_url text,
  best_score integer,
  is_guest boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ranked.player_key, ranked.display_name, ranked.avatar_url, ranked.best_score, ranked.is_guest
  from (
    select 'user:' || s.user_id::text,
           coalesce(nullif(p.display_name, ''), '普通用户'),
           p.avatar_url,
           s.best_score,
           false
    from public.jump_game_scores s
    left join public.profiles p on p.id = s.user_id
    union all
    select 'guest:' || g.guest_token,
           g.display_name,
           null::text,
           g.best_score,
           true
    from public.jump_game_guest_scores g
  ) as ranked(player_key, display_name, avatar_url, best_score, is_guest)
  order by ranked.best_score desc, ranked.display_name asc
  limit greatest(1, least(coalesce(p_limit, 50), 50));
$$;

-- 4. 权限设置
revoke all on function public.set_guest_nickname(text, text) from public;
revoke all on function public.submit_guest_jump_game_score(text, integer) from public;
revoke all on function public.list_jump_game_leaderboard(integer) from public;

grant execute on function public.set_guest_nickname(text, text) to anon, authenticated;
grant execute on function public.submit_guest_jump_game_score(text, integer) to anon, authenticated;
grant execute on function public.list_jump_game_leaderboard(integer) to anon, authenticated;

-- 5. 验证（运行完函数后取消注释测试）
-- select * from public.list_jump_game_leaderboard(10);
-- select * from public.set_guest_nickname('test-token-12345678901234567890', '测试昵称');
