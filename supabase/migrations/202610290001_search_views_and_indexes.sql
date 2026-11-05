-- Live-schema search views and indexes for the admin/teacher dashboards.
--
-- The views are security_invoker, so the existing RLS policies on the
-- underlying tables still decide which rows each role can see. They only
-- reshape rows into the columns the search API expects.

create extension if not exists pg_trgm;

-- Teacher-owned quizzes -------------------------------------------------------
create index if not exists quizzes_teacher_id_idx
  on public.quizzes (teacher_id);
create index if not exists quizzes_status_created_at_idx
  on public.quizzes (status, created_at desc);
create index if not exists quizzes_title_trgm_idx
  on public.quizzes using gin (title gin_trgm_ops);
create index if not exists quizzes_share_code_trgm_idx
  on public.quizzes using gin (share_code gin_trgm_ops);

-- Teacher accounts ------------------------------------------------------------
create index if not exists teachers_status_created_at_idx
  on public.teachers (status, created_at desc);
create index if not exists teachers_username_trgm_idx
  on public.teachers using gin (username gin_trgm_ops);
create index if not exists teachers_email_trgm_idx
  on public.teachers using gin (email gin_trgm_ops);

-- Student accounts ------------------------------------------------------------
create index if not exists account_profiles_role_teacher_idx
  on public.account_profiles (role, managed_by_teacher_id);
create index if not exists account_profiles_username_key_idx
  on public.account_profiles (username_key);
create index if not exists account_profiles_username_trgm_idx
  on public.account_profiles using gin (username gin_trgm_ops);
create index if not exists account_profiles_email_trgm_idx
  on public.account_profiles using gin (email gin_trgm_ops);


-- Students --------------------------------------------------------------------
drop view if exists public.search_students;
create view public.search_students
with (security_invoker = true)
as
select
  p.user_id::text as student_id,
  p.managed_by_teacher_id::text as teacher_id,
  coalesce(t.username, t.email, '')::text as teacher_username,
  coalesce(p.username, '')::text as username,
  coalesce(p.email, '')::text as email,
  p.created_at
from public.account_profiles p
left join public.teachers t on t.id = p.managed_by_teacher_id
where p.role = 'student';

revoke all on public.search_students from anon;
grant select on public.search_students to authenticated;

-- Quizzes ---------------------------------------------------------------------
drop view if exists public.search_quizzes;
create view public.search_quizzes
with (security_invoker = true)
as
select
  q.session_id::text as quiz_id,
  coalesce(q.teacher_id::text, '')::text as teacher_id,
  coalesce(t.username, t.email, '')::text as teacher_username,
  coalesce(q.title, 'Untitled quiz')::text as title,
  q.status::text as status,
  coalesce(question_count.total, 0)::integer as question_count,
  q.created_at
from public.quizzes q
left join public.teachers t on t.id = q.teacher_id
left join lateral (
  select count(*)::integer as total
  from public.quiz_questions qq
  where qq.session_id = q.session_id
) question_count on true;

revoke all on public.search_quizzes from anon;
grant select on public.search_quizzes to authenticated;


-- Teacher accounts ------------------------------------------------------------
drop view if exists public.search_teachers;
create view public.search_teachers
with (security_invoker = true)
as
select
  t.id::text as teacher_id,
  coalesce(t.username, t.email, '')::text as username,
  coalesce(t.email, '')::text as email,
  t.status::text as status,
  (
    select count(*)::integer
    from public.quizzes q
    where q.teacher_id = t.id
  ) as quiz_count,
  t.created_at
from public.teachers t;

revoke all on public.search_teachers from anon;
grant select on public.search_teachers to authenticated;
