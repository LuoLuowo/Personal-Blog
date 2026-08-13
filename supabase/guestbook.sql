-- Run this file once in Supabase SQL Editor.
-- Public guestbook: visitors can read and send a message without an account.

create table if not exists public.guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(trim(nickname)) between 1 and 20),
  message text not null check (char_length(trim(message)) between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists guestbook_messages_created_at_idx
  on public.guestbook_messages (created_at desc);

grant select, insert on public.guestbook_messages to anon, authenticated;
grant delete on public.guestbook_messages to authenticated;

alter table public.guestbook_messages enable row level security;

drop policy if exists "guestbook messages are readable" on public.guestbook_messages;
drop policy if exists "visitors can add guestbook messages" on public.guestbook_messages;
drop policy if exists "admin deletes guestbook messages" on public.guestbook_messages;

create policy "guestbook messages are readable" on public.guestbook_messages
  for select using (true);

create policy "visitors can add guestbook messages" on public.guestbook_messages
  for insert with check (
    char_length(trim(nickname)) between 1 and 20
    and char_length(trim(message)) between 1 and 180
  );

create policy "admin deletes guestbook messages" on public.guestbook_messages
  for delete to authenticated using (public.is_blog_admin());
