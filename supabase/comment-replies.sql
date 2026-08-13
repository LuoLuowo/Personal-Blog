-- Run once in Supabase SQL Editor. Adds threaded replies to comments.
alter table public.post_comments add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;
alter table public.content_comments add column if not exists parent_id uuid references public.content_comments(id) on delete cascade;
create index if not exists post_comments_parent_idx on public.post_comments(parent_id);
create index if not exists content_comments_parent_idx on public.content_comments(parent_id);
