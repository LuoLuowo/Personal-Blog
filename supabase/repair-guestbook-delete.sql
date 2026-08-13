-- Run this once in Supabase SQL Editor.
-- Keeps all current guestbook messages. It only enables admin deletion.

grant delete on public.guestbook_messages to authenticated;

alter table public.guestbook_messages enable row level security;

drop policy if exists "admin deletes guestbook messages" on public.guestbook_messages;
create policy "admin deletes guestbook messages" on public.guestbook_messages
  for delete to authenticated using (public.is_blog_admin());
