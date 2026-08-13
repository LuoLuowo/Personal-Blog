-- Run this once in Supabase SQL Editor.
-- Stores one highest score per registered user for Xiao Luo Jump.

create table if not exists public.jump_game_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  best_score integer not null default 0 check (best_score >= 0 and best_score <= 1000000),
  updated_at timestamptz not null default now()
);

alter table public.jump_game_scores enable row level security;

grant select on public.jump_game_scores to anon, authenticated;

drop policy if exists "jump scores are readable" on public.jump_game_scores;
create policy "jump scores are readable" on public.jump_game_scores
  for select using (true);

drop policy if exists "players insert own jump score" on public.jump_game_scores;
drop policy if exists "players update own jump score" on public.jump_game_scores;
create policy "players insert own jump score" on public.jump_game_scores
  for insert to authenticated with check (auth.uid() = user_id);
create policy "players update own jump score" on public.jump_game_scores
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.submit_jump_game_score(p_score integer)
returns public.jump_game_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.jump_game_scores;
begin
  if auth.uid() is null then
    raise exception '请先登录后再保存成绩';
  end if;
  if p_score is null or p_score < 0 or p_score > 1000000 then
    raise exception '无效的游戏分数';
  end if;

  insert into public.jump_game_scores (user_id, best_score, updated_at)
  values (auth.uid(), p_score, now())
  on conflict (user_id) do update
    set best_score = greatest(public.jump_game_scores.best_score, excluded.best_score),
        updated_at = case when excluded.best_score > public.jump_game_scores.best_score then now() else public.jump_game_scores.updated_at end
  returning * into saved;

  return saved;
end;
$$;

grant execute on function public.submit_jump_game_score(integer) to authenticated;
