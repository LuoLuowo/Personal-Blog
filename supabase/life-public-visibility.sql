-- Run once in Supabase SQL Editor.
-- Adds per-post public visibility for the administrator's life-circle entries.

alter table public.moments add column if not exists is_public boolean not null default false;
create index if not exists moments_public_visibility_idx on public.moments (user_id, is_public, entry_date desc);

alter table public.moments enable row level security;
grant select on public.moments to anon, authenticated;

drop policy if exists "moments are readable" on public.moments;
create policy "moments are readable" on public.moments
  for select using (
    is_public
    or public.is_blog_admin()
    or (auth.uid() is not null and public.has_activity_access(50))
  );

-- Visitors who have not unlocked the life circle only receive date-only lock previews.
-- Titles, text and image URLs for locked entries are never returned by this function.
create or replace function public.list_locked_moment_teasers(p_owner_id uuid)
returns table(id uuid, entry_date date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.entry_date
  from public.moments m
  where m.user_id = p_owner_id
    and not m.is_public
    and not public.is_blog_admin()
    and not public.has_activity_access(50)
  order by m.entry_date desc, m.created_at desc;
$$;

revoke all on function public.list_locked_moment_teasers(uuid) from public;
grant execute on function public.list_locked_moment_teasers(uuid) to anon, authenticated;
