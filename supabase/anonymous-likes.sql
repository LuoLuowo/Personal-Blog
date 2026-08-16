-- ============================================================
-- 匿名用户点赞支持
-- 在 Supabase SQL Editor 中运行一次即可。
-- 1. post_likes / content_likes 增加 visitor_id 字段
-- 2. user_id 改为可空（匿名用户无 user_id）
-- 3. 唯一约束改为部分唯一索引（处理 NULL user_id）
-- 4. 授予 anon 角色 insert/delete 权限
-- 5. 更新 RLS 策略，允许匿名用户通过 visitor_id 管理自己的点赞
-- ============================================================

-- ===== post_likes =====
alter table public.post_likes
  alter column user_id drop not null,
  add column if not exists visitor_id text;

-- 旧的唯一约束 (post_id, user_id) 无法处理 NULL user_id，替换为部分唯一索引
alter table public.post_likes drop constraint if exists post_likes_post_id_user_id_key;
create unique index if not exists post_likes_post_id_user_id_idx
  on public.post_likes (post_id, user_id)
  where user_id is not null;
create unique index if not exists post_likes_post_id_visitor_id_idx
  on public.post_likes (post_id, visitor_id)
  where visitor_id is not null;

-- ===== content_likes =====
alter table public.content_likes
  alter column user_id drop not null,
  add column if not exists visitor_id text;

alter table public.content_likes drop constraint if exists content_likes_content_type_content_id_user_id_key;
create unique index if not exists content_likes_type_id_user_id_idx
  on public.content_likes (content_type, content_id, user_id)
  where user_id is not null;
create unique index if not exists content_likes_type_id_visitor_id_idx
  on public.content_likes (content_type, content_id, visitor_id)
  where visitor_id is not null;

-- ===== 权限 =====
grant insert, delete on public.post_likes to anon;
grant insert, delete on public.content_likes to anon;

-- ===== RLS 策略 =====
-- post_likes：登录用户管理自己的，匿名用户通过 visitor_id 管理
drop policy if exists "users manage own likes" on public.post_likes;
drop policy if exists "anon manage own likes" on public.post_likes;
create policy "users manage own likes" on public.post_likes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "anon manage own likes" on public.post_likes
  for all to anon
  using (visitor_id is not null)
  with check (visitor_id is not null);

-- content_likes：同上
drop policy if exists "users manage own content likes" on public.content_likes;
drop policy if exists "anon manage own content likes" on public.content_likes;
create policy "users manage own content likes" on public.content_likes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "anon manage own content likes" on public.content_likes
  for all to anon
  using (visitor_id is not null)
  with check (visitor_id is not null);
