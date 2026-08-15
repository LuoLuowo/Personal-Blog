-- Run this smaller upgrade after closing any open blog pages and refreshing SQL Editor.
-- It adds the latest guest game, friend-link and whisper-reply features only.

alter table public.whispers add column if not exists parent_id uuid references public.whispers(id) on delete cascade;
create index if not exists whispers_parent_id_idx on public.whispers (parent_id);

create or replace function public.validate_whisper_reply_depth()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.parent_id is not null and exists (
    select 1 from public.whispers where id = new.parent_id and parent_id is not null
  ) then raise exception '碎碎念最多只能回复一层'; end if;
  return new;
end;
$$;
drop trigger if exists validate_whisper_reply_depth_trigger on public.whispers;
create trigger validate_whisper_reply_depth_trigger before insert or update of parent_id on public.whispers
  for each row execute function public.validate_whisper_reply_depth();

create table if not exists public.whisper_templates (
  id uuid primary key default gen_random_uuid(), content text not null check (char_length(trim(content)) between 1 and 120),
  sort_order integer not null default 0, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
alter table public.whisper_templates enable row level security;
grant select, insert, update, delete on public.whisper_templates to authenticated;
drop policy if exists "logged users read whisper templates" on public.whisper_templates;
drop policy if exists "admins manage whisper templates" on public.whisper_templates;
create policy "logged users read whisper templates" on public.whisper_templates for select to authenticated using (true);
create policy "admins manage whisper templates" on public.whisper_templates for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());
insert into public.whisper_templates (content, sort_order)
select seed.content, seed.sort_order from (values
  ('今天午饭吃的是：', 10), ('我今天发现：', 20), ('今天干了什么：', 30), ('今天遇到的好事：', 40),
  ('打算去做什么：', 50), ('几点起床：', 60), ('她是怎样的人：', 70), ('想对某人说的话：', 80)
) as seed(content, sort_order) where not exists (select 1 from public.whisper_templates t where t.content = seed.content);

create table if not exists public.jump_game_guest_scores (
  guest_token text primary key check (char_length(guest_token) between 20 and 100), display_name text not null unique,
  best_score integer not null default 0 check (best_score between 0 and 1000000), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.jump_game_guest_scores enable row level security;
grant select on public.jump_game_guest_scores to anon, authenticated;
drop policy if exists "guest jump scores are readable" on public.jump_game_guest_scores;
create policy "guest jump scores are readable" on public.jump_game_guest_scores for select using (true);

create or replace function public.submit_guest_jump_game_score(p_guest_token text, p_score integer)
returns table(guest_token text, display_name text, best_score integer)
language plpgsql security definer set search_path = public as $$
declare next_name text;
begin
  if p_guest_token is null or char_length(p_guest_token) < 20 or char_length(p_guest_token) > 100 then raise exception '游客身份无效'; end if;
  if p_score is null or p_score < 0 or p_score > 1000000 then raise exception '无效的游戏分数'; end if;
  select g.display_name into next_name from public.jump_game_guest_scores g where g.guest_token = p_guest_token;
  if next_name is null then next_name := '罗星人' || ((select count(*) from public.jump_game_guest_scores) + 1)::text; end if;
  insert into public.jump_game_guest_scores (guest_token, display_name, best_score, updated_at) values (p_guest_token, next_name, p_score, now())
  on conflict on constraint jump_game_guest_scores_pkey do update set best_score = greatest(public.jump_game_guest_scores.best_score, excluded.best_score), updated_at = case when excluded.best_score > public.jump_game_guest_scores.best_score then now() else public.jump_game_guest_scores.updated_at end;
  return query select g.guest_token, g.display_name, g.best_score from public.jump_game_guest_scores g where g.guest_token = p_guest_token;
end;
$$;

create or replace function public.list_jump_game_leaderboard(p_limit integer default 20)
returns table(player_key text, display_name text, avatar_url text, best_score integer, is_guest boolean)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'user:' || s.user_id::text as player_key, coalesce(nullif(p.display_name, ''), '普通用户') as display_name, p.avatar_url as avatar_url, s.best_score as best_score, false as is_guest from public.jump_game_scores s left join public.profiles p on p.id = s.user_id
    union all
    select 'guest:' || g.guest_token as player_key, g.display_name as display_name, null::text as avatar_url, g.best_score as best_score, true as is_guest from public.jump_game_guest_scores g
  ) ranked order by best_score desc, display_name asc limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
grant execute on function public.submit_guest_jump_game_score(text, integer) to anon, authenticated;
grant execute on function public.list_jump_game_leaderboard(integer) to anon, authenticated;

create table if not exists public.friend_links (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(trim(name)) between 1 and 40), description text not null default '' check (char_length(description) <= 120), url text not null check (url ~* '^https?://'), icon_url text, sort_order integer not null default 0, created_at timestamptz not null default now()
);
alter table public.friend_links enable row level security;
grant select on public.friend_links to anon, authenticated;
grant insert, update, delete on public.friend_links to authenticated;
drop policy if exists "public read friend links" on public.friend_links;
drop policy if exists "admin manage friend links" on public.friend_links;
create policy "public read friend links" on public.friend_links for select using (true);
create policy "admin manage friend links" on public.friend_links for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());
