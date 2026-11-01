-- VELTRIX WARFARE account profile: editable identity + private role authority.
-- Run this migration in the Supabase SQL Editor if migrations are not automated.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;

-- Backfill existing accounts without changing their role or membership.
update public.profiles p
set username = lower(regexp_replace(split_part(coalesce(u.email, 'member'), '@', 1), '[^a-zA-Z0-9._]', '', 'g')) || '_' || substr(p.id::text, 1, 5)
from auth.users u
where u.id = p.id and (p.username is null or btrim(p.username) = '');

insert into public.profiles (id, full_name, username, role)
select
  u.id,
  nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
  left(coalesce(nullif(lower(regexp_replace(split_part(coalesce(u.email, 'member'), '@', 1), '[^a-zA-Z0-9._]', '', 'g')), ''), 'member'), 18) || '_' || substr(u.id::text, 1, 5),
  'member'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;

-- New signups receive a profile row; the role is always assigned as member.
create or replace function public.handle_new_veltrix_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := lower(regexp_replace(split_part(coalesce(new.email, 'member'), '@', 1), '[^a-zA-Z0-9._]', '', 'g'));
  if length(base_username) < 3 then base_username := 'member'; end if;
  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    left(base_username, 18) || '_' || substr(new.id::text, 1, 5),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_veltrix on auth.users;
create trigger on_auth_user_created_veltrix
after insert on auth.users
for each row execute procedure public.handle_new_veltrix_user();

-- Existing authenticated users may edit only their own public profile fields.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from anon, authenticated;
grant update (full_name, username, avatar_url) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

-- Public avatar URLs are intended for profile display. Upload/delete is restricted
-- to the authenticated user's own folder; admins can read profiles via table RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
