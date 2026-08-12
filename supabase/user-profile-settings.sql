-- Run this file once in Supabase SQL Editor.
-- New normal accounts become 普通用户1, 普通用户2 ... 普通用户999.

create sequence if not exists public.normal_user_number_seq start 1 minvalue 1 maxvalue 999;

create or replace function public.assign_normal_user_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_admin, false) = false and (new.display_name is null or btrim(new.display_name) = '' or new.display_name in ('小罗', 'Xiao Luo')) then
    new.display_name := '普通用户' || nextval('public.normal_user_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists assign_normal_user_name on public.profiles;
create trigger assign_normal_user_name
before insert on public.profiles
for each row execute function public.assign_normal_user_name();

-- Rename already-created normal accounts that still have the old default name.
update public.profiles
set display_name = '普通用户' || nextval('public.normal_user_number_seq')
where is_admin = false and display_name in ('小罗', 'Xiao Luo');

-- Allow each signed-in user to upload only their own avatar in the existing public bucket.
drop policy if exists "users upload own avatars" on storage.objects;
drop policy if exists "users update own avatars" on storage.objects;
drop policy if exists "users delete own avatars" on storage.objects;
create policy "users upload own avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'xiaoluo-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'avatars');
create policy "users update own avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'xiaoluo-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'avatars');
create policy "users delete own avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'xiaoluo-media' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] = 'avatars');
