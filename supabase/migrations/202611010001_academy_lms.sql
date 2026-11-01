-- VELTRIX WARFARE ACADEMY LMS
-- Run this migration in Supabase SQL Editor. Admin permissions are enforced by RLS,
-- not by hiding frontend buttons. Existing profiles.role + public.is_admin() are reused.

create extension if not exists pgcrypto;

create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  level text not null default 'Beginner' check (level in ('Beginner','Intermediate','Advanced','All levels')),
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.academy_chapters(id) on delete cascade,
  title text not null,
  summary text,
  content text not null default '',
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 600),
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists academy_chapters_course_order_idx on public.academy_chapters(course_id, sort_order);
create index if not exists academy_lessons_chapter_order_idx on public.academy_lessons(chapter_id, sort_order);
create index if not exists academy_resources_lesson_idx on public.academy_resources(lesson_id);

create or replace function public.academy_has_access()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_admin() or exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
  );
$$;
revoke all on function public.academy_has_access() from public, anon;
grant execute on function public.academy_has_access() to authenticated;

alter table public.academy_courses enable row level security;
alter table public.academy_chapters enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_resources enable row level security;

-- Members with active access can read published curriculum only. Admins can manage all rows.
drop policy if exists academy_courses_read on public.academy_courses;
create policy academy_courses_read on public.academy_courses for select to authenticated
using ((status = 'published' and public.academy_has_access()) or public.is_admin());
drop policy if exists academy_courses_admin_insert on public.academy_courses;
create policy academy_courses_admin_insert on public.academy_courses for insert to authenticated with check (public.is_admin());
drop policy if exists academy_courses_admin_update on public.academy_courses;
create policy academy_courses_admin_update on public.academy_courses for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists academy_courses_admin_delete on public.academy_courses;
create policy academy_courses_admin_delete on public.academy_courses for delete to authenticated using (public.is_admin());

drop policy if exists academy_chapters_read on public.academy_chapters;
create policy academy_chapters_read on public.academy_chapters for select to authenticated
using (public.is_admin() or (status = 'published' and public.academy_has_access() and exists (
  select 1 from public.academy_courses c where c.id = course_id and c.status = 'published'
)));
drop policy if exists academy_chapters_admin_insert on public.academy_chapters;
create policy academy_chapters_admin_insert on public.academy_chapters for insert to authenticated with check (public.is_admin());
drop policy if exists academy_chapters_admin_update on public.academy_chapters;
create policy academy_chapters_admin_update on public.academy_chapters for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists academy_chapters_admin_delete on public.academy_chapters;
create policy academy_chapters_admin_delete on public.academy_chapters for delete to authenticated using (public.is_admin());

drop policy if exists academy_lessons_read on public.academy_lessons;
create policy academy_lessons_read on public.academy_lessons for select to authenticated
using (public.is_admin() or (status = 'published' and public.academy_has_access() and exists (
  select 1 from public.academy_chapters ch join public.academy_courses c on c.id = ch.course_id
  where ch.id = chapter_id and ch.status = 'published' and c.status = 'published'
)));
drop policy if exists academy_lessons_admin_insert on public.academy_lessons;
create policy academy_lessons_admin_insert on public.academy_lessons for insert to authenticated with check (public.is_admin());
drop policy if exists academy_lessons_admin_update on public.academy_lessons;
create policy academy_lessons_admin_update on public.academy_lessons for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists academy_lessons_admin_delete on public.academy_lessons;
create policy academy_lessons_admin_delete on public.academy_lessons for delete to authenticated using (public.is_admin());

drop policy if exists academy_resources_read on public.academy_resources;
create policy academy_resources_read on public.academy_resources for select to authenticated
using (public.is_admin() or (public.academy_has_access() and exists (
  select 1 from public.academy_lessons l join public.academy_chapters ch on ch.id = l.chapter_id join public.academy_courses c on c.id = ch.course_id
  where l.id = lesson_id and l.status = 'published' and ch.status = 'published' and c.status = 'published'
)));
drop policy if exists academy_resources_admin_insert on public.academy_resources;
create policy academy_resources_admin_insert on public.academy_resources for insert to authenticated with check (public.is_admin());
drop policy if exists academy_resources_admin_delete on public.academy_resources;
create policy academy_resources_admin_delete on public.academy_resources for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.academy_courses, public.academy_chapters, public.academy_lessons, public.academy_resources to authenticated;
revoke all on public.academy_courses, public.academy_chapters, public.academy_lessons, public.academy_resources from anon;

-- Private bucket: members can download only resources belonging to published lessons;
-- only admins can upload or remove files.
insert into storage.buckets (id, name, public, file_size_limit)
values ('academy-files','academy-files',false,26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists academy_files_admin_upload on storage.objects;
create policy academy_files_admin_upload on storage.objects for insert to authenticated
with check (bucket_id = 'academy-files' and public.is_admin());
drop policy if exists academy_files_authorized_read on storage.objects;
create policy academy_files_authorized_read on storage.objects for select to authenticated
using (bucket_id = 'academy-files' and (
  public.is_admin() or (public.academy_has_access() and exists (
    select 1 from public.academy_resources r
    join public.academy_lessons l on l.id = r.lesson_id
    join public.academy_chapters ch on ch.id = l.chapter_id
    join public.academy_courses c on c.id = ch.course_id
    where r.file_path = name and l.status = 'published' and ch.status = 'published' and c.status = 'published'
  ))
));
drop policy if exists academy_files_admin_delete on storage.objects;
create policy academy_files_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'academy-files' and public.is_admin());

-- Keep timestamps current on updates.
create or replace function public.academy_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists academy_courses_touch on public.academy_courses;
create trigger academy_courses_touch before update on public.academy_courses for each row execute function public.academy_touch_updated_at();
drop trigger if exists academy_chapters_touch on public.academy_chapters;
create trigger academy_chapters_touch before update on public.academy_chapters for each row execute function public.academy_touch_updated_at();
drop trigger if exists academy_lessons_touch on public.academy_lessons;
create trigger academy_lessons_touch before update on public.academy_lessons for each row execute function public.academy_touch_updated_at();

-- Realtime content updates (safe to run repeatedly).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='academy_courses') then alter publication supabase_realtime add table public.academy_courses; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='academy_chapters') then alter publication supabase_realtime add table public.academy_chapters; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='academy_lessons') then alter publication supabase_realtime add table public.academy_lessons; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='academy_resources') then alter publication supabase_realtime add table public.academy_resources; end if;
  end if;
end $$;
