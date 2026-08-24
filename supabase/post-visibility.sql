-- Run once in Supabase SQL Editor to enable private articles.
-- Public visitors only receive published rows; the owner can still read/manage private rows through RLS.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  where con.conrelid = 'public.posts'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%status%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.posts drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.posts add constraint posts_status_check check (status in ('draft', 'published', 'private'));
alter table public.posts alter column status set default 'published';
