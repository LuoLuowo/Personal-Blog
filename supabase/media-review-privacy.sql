-- Run this file once in Supabase SQL Editor.
-- It adds per-item review visibility for the media list.

alter table public.media_items
  add column if not exists review_is_public boolean not null default true;

alter table public.media_reviews
  add column if not exists is_public boolean not null default true;

-- Existing reviews are public by default, matching the new editor default.
update public.media_reviews
set is_public = true
where is_public is null;

grant select on table public.media_reviews to anon, authenticated;

drop policy if exists "public media reviews are readable" on public.media_reviews;
create policy "public media reviews are readable"
  on public.media_reviews
  for select
  using (is_public = true or public.is_blog_admin());
