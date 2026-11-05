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

-- Participants ----------------------------------------------------------------
create index if not exists students_session_id_idx
  on public.students (session_id);
create index if not exists students_username_trgm_idx
  on public.students using gin (username gin_trgm_ops);
create index if not exists quiz_questions_session_id_idx
  on public.quiz_questions (session_id);
create index if not exists quiz_results_session_participant_completed_idx
  on public.quiz_results (
    session_id,
    participant_username,
    completed_at desc
  );
create index if not exists quiz_attempts_session_participant_created_idx
  on public.quiz_attempts (
    session_id,
    participant_username,
    created_at desc
  );

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

-- Participants ----------------------------------------------------------------
drop view if exists public.search_participants;
create view public.search_participants
with (security_invoker = true)
as
select
  s.id::text as participant_id,
  s.session_id::text as session_id,
  coalesce(q.share_code, '')::text as session_code,
  coalesce(q.session_id, s.session_id)::text as quiz_id,
  coalesce(q.title, 'Untitled quiz')::text as quiz_title,
  s.username::text as username,
  case
    when latest_result.attempt_id is not null then 'completed'
    when latest_attempt.attempt_id is not null then 'in_progress'
    else 'not_started'
  end::text as status,
  latest_result.percentage as score,
  s.created_at as joined_at,
  coalesce(student.email, '')::text as student_email,
  coalesce(q.teacher_id::text, '')::text as teacher_id,
  coalesce(t.username, t.email, '')::text as teacher_username
from public.students s
left join public.quizzes q on q.session_id = s.session_id
left join public.teachers t on t.id = q.teacher_id
left join lateral (
  select r.attempt_id, r.percentage
  from public.quiz_results r
  where r.session_id = s.session_id
    and r.participant_username = s.username
  order by r.completed_at desc
  limit 1
) latest_result on true
left join lateral (
  select a.attempt_id
  from public.quiz_attempts a
  where a.session_id = s.session_id
    and a.participant_username = s.username
  order by a.created_at desc
  limit 1
) latest_attempt on true
left join lateral (
  select p.email
  from public.account_profiles p
  where p.role = 'student'
    and (
      p.username_key = lower(s.username)
      or lower(p.username) = lower(s.username)
    )
  order by p.created_at
  limit 1
) student on true;

revoke all on public.search_participants from anon;
grant select on public.search_participants to authenticated;

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
