-- Run this entire file once in Supabase SQL Editor.
-- Adds unique anonymous reading counts and the login-only whispers feed.

alter table public.post_views add column if not exists visitor_id text;
alter table public.post_views alter column user_id drop not null;
update public.post_views set visitor_id = 'user:' || user_id::text where visitor_id is null and user_id is not null;
create unique index if not exists post_views_post_visitor_unique
  on public.post_views (post_id, visitor_id);

alter table public.content_views add column if not exists visitor_id text;
alter table public.content_views alter column user_id drop not null;
update public.content_views set visitor_id = 'user:' || user_id::text where visitor_id is null and user_id is not null;
create unique index if not exists content_views_content_visitor_unique
  on public.content_views (content_type, content_id, visitor_id);

grant select, insert on public.post_views, public.content_views to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists "users add own views" on public.post_views;
drop policy if exists "visitors add unique post views" on public.post_views;
create policy "visitors add unique post views" on public.post_views
  for insert to anon, authenticated
  with check (
    visitor_id is not null
    and char_length(visitor_id) between 8 and 100
    and (user_id is null or auth.uid() = user_id)
  );

drop policy if exists "users add own content views" on public.content_views;
drop policy if exists "visitors add unique content views" on public.content_views;
create policy "visitors add unique content views" on public.content_views
  for insert to anon, authenticated
  with check (
    visitor_id is not null
    and char_length(visitor_id) between 8 and 100
    and (user_id is null or auth.uid() = user_id)
  );

create table if not exists public.whispers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whispers_created_at_idx on public.whispers (created_at desc);
create index if not exists whispers_user_id_idx on public.whispers (user_id);

grant select, insert, delete on public.whispers to authenticated;
alter table public.whispers enable row level security;

drop policy if exists "logged users read whispers" on public.whispers;
drop policy if exists "users publish own whispers" on public.whispers;
drop policy if exists "users delete own whispers" on public.whispers;
create policy "logged users read whispers" on public.whispers
  for select to authenticated using (true);
create policy "users publish own whispers" on public.whispers
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete own whispers" on public.whispers
  for delete to authenticated using (auth.uid() = user_id or public.is_blog_admin());

-- Public profile cards may show only a small preview, never the complete feed.
create or replace function public.get_public_whisper_summary(p_user_id uuid)
returns table(total_count bigint, previews jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select content, created_at
    from public.whispers
    where user_id = p_user_id
    order by created_at desc
    limit 1
  ), totals as (
    select count(*)::bigint as total_count
    from public.whispers
    where user_id = p_user_id
  )
  select
    totals.total_count,
    coalesce(
      jsonb_agg(jsonb_build_object('content', recent.content, 'created_at', recent.created_at)
        order by recent.created_at desc) filter (where recent.created_at is not null),
      '[]'::jsonb
    ) as previews
  from totals
  left join recent on true
  group by totals.total_count;
$$;

grant execute on function public.get_public_whisper_summary(uuid) to anon, authenticated;
