-- 在 Supabase SQL Editor 中完整运行一次，用于启用“书籍影单”。
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_url text,
  rating numeric(3,1) not null default 0 check (rating >= 0 and rating <= 10),
  media_type text not null default '电影',
  tags jsonb not null default '[]'::jsonb,
  people text not null default '',
  note_url text,
  watched_year integer check (watched_year is null or watched_year between 1900 and 2200),
  watched_month integer check (watched_month is null or watched_month between 1 and 12),
  watched_day integer check (watched_day is null or watched_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 兼容此前已执行过本文件的项目。
alter table public.media_items add column if not exists watched_year integer check (watched_year is null or watched_year between 1900 and 2200);
alter table public.media_items add column if not exists watched_month integer check (watched_month is null or watched_month between 1 and 12);
alter table public.media_items add column if not exists watched_day integer check (watched_day is null or watched_day between 1 and 31);
alter table public.media_items add column if not exists note_url text;
alter table public.media_items add column if not exists tags jsonb not null default '[]'::jsonb;

create table if not exists public.media_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.media_types add column if not exists is_hidden boolean not null default false;

-- 观后感单独储存，只有管理员能读取，访客不会拿到文字内容。
create table if not exists public.media_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_item_id uuid not null unique references public.media_items(id) on delete cascade,
  review_title text not null default '观后感',
  review text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.media_reviews add column if not exists review_title text not null default '观后感';

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'media_items' and column_name = 'review') then
    execute $sql$insert into public.media_reviews (user_id, media_item_id, review) select user_id, id, coalesce(nullif(review, ''), description, '') from public.media_items on conflict (media_item_id) do nothing$sql$;
    execute $sql$update public.media_items set review = '', description = ''$sql$;
  else
    insert into public.media_reviews (user_id, media_item_id, review)
      select user_id, id, description from public.media_items where description <> ''
      on conflict (media_item_id) do nothing;
    update public.media_items set description = '' where description <> '';
  end if;
end $$;

alter table public.media_items enable row level security;
alter table public.media_types enable row level security;
alter table public.media_reviews enable row level security;
grant select on table public.media_items, public.media_types to anon, authenticated;
grant select on table public.media_reviews to authenticated;
grant insert, update, delete on table public.media_items, public.media_types, public.media_reviews to authenticated;

drop policy if exists "media items are publicly readable" on public.media_items;
drop policy if exists "admins manage media items" on public.media_items;
create policy "media items are publicly readable" on public.media_items for select using (true);
create policy "admins manage media items" on public.media_items for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());

drop policy if exists "media types are publicly readable" on public.media_types;
drop policy if exists "admins manage media types" on public.media_types;
create policy "media types are publicly readable" on public.media_types for select using (true);
create policy "admins manage media types" on public.media_types for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());

drop policy if exists "admins manage media reviews" on public.media_reviews;
create policy "admins manage media reviews" on public.media_reviews for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());
