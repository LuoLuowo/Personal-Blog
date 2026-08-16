-- ============================================================
-- 跳一跳排行榜（最终版，无歧义）
-- 需求：
--   1. 登录用户：玩一次自动上榜，无需操作
--   2. 游客（未注册）：点击"参与排行榜"设置昵称后上榜
--
-- 在 Supabase SQL Editor 中完整运行一次。
-- ============================================================

-- 先删除旧函数（返回类型不同，必须先 drop）
drop function if exists public.submit_jump_game_score(integer);
drop function if exists public.set_guest_nickname(text, text);
drop function if exists public.submit_guest_jump_game_score(text, integer);
drop function if exists public.list_jump_game_leaderboard(integer);

-- 确保表存在
create table if not exists public.jump_game_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  best_score integer not null default 0 check (best_score between 0 and 1000000),
  updated_at timestamptz not null default now()
);
alter table public.jump_game_scores enable row level security;
drop policy if exists "jump scores readable" on public.jump_game_scores;
create policy "jump scores readable" on public.jump_game_scores for select using (true);
drop policy if exists "users update own jump score" on public.jump_game_scores;
create policy "users update own jump score" on public.jump_game_scores for update using (auth.uid() = user_id);

create table if not exists public.jump_game_guest_scores (
  guest_token text primary key check (char_length(guest_token) between 20 and 100),
  display_name text not null unique check (char_length(display_name) between 1 and 20),
  best_score integer not null default 0 check (best_score between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jump_game_guest_scores enable row level security;
drop policy if exists "guest jump scores readable" on public.jump_game_guest_scores;
create policy "guest jump scores readable" on public.jump_game_guest_scores for select using (true);

-- ============================================================
-- 函数1：登录用户提交分数（自动上榜）
-- 输出列名加 out_ 前缀，避免与表列名冲突
-- ============================================================
create or replace function public.submit_jump_game_score(p_score integer)
returns table(out_best_score integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception '请先登录';
  end if;
  if p_score is null or p_score < 0 or p_score > 1000000 then
    raise exception '无效的游戏分数';
  end if;
  insert into public.jump_game_scores (user_id, best_score, updated_at)
  values (v_uid, p_score, now())
  on conflict (user_id) do update
    set best_score = greatest(public.jump_game_scores.best_score, p_score),
        updated_at = case when p_score > public.jump_game_scores.best_score then now() else public.jump_game_scores.updated_at end;
  return query
    select s.best_score from public.jump_game_scores s where s.user_id = v_uid;
end;
$$;

-- ============================================================
-- 函数2：游客设置昵称（参与排行榜）
-- ============================================================
create or replace function public.set_guest_nickname(p_guest_token text, p_nickname text)
returns table(out_display_name text, out_best_score integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean text;
begin
  if p_guest_token is null or char_length(p_guest_token) < 20 or char_length(p_guest_token) > 100 then
    raise exception '游客身份无效';
  end if;
  v_clean := btrim(coalesce(p_nickname, ''));
  if char_length(v_clean) < 1 or char_length(v_clean) > 20 then
    raise exception '昵称长度需在1-20个字符之间';
  end if;
  if exists (
    select 1 from public.jump_game_guest_scores g
    where g.display_name = v_clean and g.guest_token <> p_guest_token
  ) then
    raise exception '这个昵称已经被占用了，换一个吧';
  end if;
  insert into public.jump_game_guest_scores (guest_token, display_name, best_score, created_at, updated_at)
  values (p_guest_token, v_clean, 0, now(), now())
  on conflict (guest_token) do update
    set display_name = excluded.display_name, updated_at = now();
  return query
    select g.display_name, g.best_score
    from public.jump_game_guest_scores g
    where g.guest_token = p_guest_token;
end;
$$;

-- ============================================================
-- 函数3：游客提交分数（只有已设昵称的游客才保存）
-- ============================================================
create or replace function public.submit_guest_jump_game_score(p_guest_token text, p_score integer)
returns table(out_display_name text, out_best_score integer)
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
  update public.jump_game_guest_scores g
  set best_score = greatest(g.best_score, p_score),
      updated_at = case when p_score > g.best_score then now() else g.updated_at end
  where g.guest_token = p_guest_token;
  return query
    select g.display_name, g.best_score
    from public.jump_game_guest_scores g
    where g.guest_token = p_guest_token;
end;
$$;

-- ============================================================
-- 函数4：排行榜（登录用户 + 已设昵称游客，前50名）
-- ============================================================
create or replace function public.list_jump_game_leaderboard(p_limit integer default 50)
returns table(
  out_player_key text,
  out_display_name text,
  out_avatar_url text,
  out_best_score integer,
  out_is_guest boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.player_key, r.display_name, r.avatar_url, r.best_score, r.is_guest
  from (
    select 'user:' || s.user_id::text as player_key,
           coalesce(nullif(p.display_name, ''), '普通用户') as display_name,
           p.avatar_url as avatar_url,
           s.best_score as best_score,
           false as is_guest
    from public.jump_game_scores s
    left join public.profiles p on p.id = s.user_id
    union all
    select 'guest:' || g.guest_token as player_key,
           g.display_name as display_name,
           null::text as avatar_url,
           g.best_score as best_score,
           true as is_guest
    from public.jump_game_guest_scores g
  ) r
  order by r.best_score desc, r.display_name asc
  limit greatest(1, least(coalesce(p_limit, 50), 50));
$$;

-- ============================================================
-- 函数5：管理员删除游客榜单记录
-- ============================================================
create or replace function public.delete_guest_jump_score(p_guest_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception '无权限操作';
  end if;
  delete from public.jump_game_guest_scores where guest_token = p_guest_token;
end;
$$;

-- ============================================================
-- 权限
-- ============================================================
revoke all on function public.submit_jump_game_score(integer) from public;
revoke all on function public.set_guest_nickname(text, text) from public;
revoke all on function public.submit_guest_jump_game_score(text, integer) from public;
revoke all on function public.list_jump_game_leaderboard(integer) from public;
revoke all on function public.delete_guest_jump_score(text) from public;

grant execute on function public.submit_jump_game_score(integer) to authenticated;
grant execute on function public.set_guest_nickname(text, text) to anon, authenticated;
grant execute on function public.submit_guest_jump_game_score(text, integer) to anon, authenticated;
grant execute on function public.list_jump_game_leaderboard(integer) to anon, authenticated;
grant execute on function public.delete_guest_jump_score(text) to authenticated;

-- ============================================================
-- 验证（运行完后取消注释测试）
-- select * from public.list_jump_game_leaderboard(10);
-- ============================================================
