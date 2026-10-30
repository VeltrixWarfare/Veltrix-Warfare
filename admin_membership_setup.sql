-- VELTRIX WARFARE: admin access + membership management
-- Run this in Supabase SQL Editor using the project owner account.
-- Never put a service_role key in the frontend.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'Essential',
  status text not null default 'inactive' check (status in ('inactive', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

-- SECURITY DEFINER prevents profile RLS from blocking the role check itself.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Profiles: users can read their own profile; admins can list profiles.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select to authenticated using (public.is_admin());

-- Memberships: users can read only their own; admins can manage memberships.
drop policy if exists "memberships_select_own" on public.memberships;
create policy "memberships_select_own" on public.memberships
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "memberships_admin_select_all" on public.memberships;
create policy "memberships_admin_select_all" on public.memberships
  for select to authenticated using (public.is_admin());
drop policy if exists "memberships_admin_insert" on public.memberships;
create policy "memberships_admin_insert" on public.memberships
  for insert to authenticated with check (public.is_admin());
drop policy if exists "memberships_admin_update" on public.memberships;
create policy "memberships_admin_update" on public.memberships
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "memberships_admin_delete" on public.memberships;
create policy "memberships_admin_delete" on public.memberships
  for delete to authenticated using (public.is_admin());

grant select on public.profiles to authenticated;
grant select on public.memberships to authenticated;
grant insert, update, delete on public.memberships to authenticated;

-- IMPORTANT: after your account has registered, promote ONLY your own known account.
-- Replace the email below with the exact email you registered with, then run separately:
-- update public.profiles p
-- set role = 'admin'
-- from auth.users u
-- where p.id = u.id and lower(u.email) = lower('YOUR-ADMIN-EMAIL@example.com');
-- Verify with:
-- select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id;
