-- Run via: npx supabase migration new search_views_quiz_sessions
-- then paste this file's contents into the generated file.
--
-- The app writes quizzes to public.quiz_sessions (teacher_id = auth user id as
-- text), not public.quizzes. These views keep the same columns the search API
-- already expects (teacher_id is still teachers.id as text), but read from
-- quiz_sessions. All views stay security_invoker, so RLS still decides rows.

-- Admins need to read every quiz session (teachers already read their own).
drop policy if exists "admins read all quiz sessions" on public.quiz_sessions;
create policy "admins read all quiz sessions"
on public.quiz_sessions for select to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create extension if not exists pg_trgm;

create index if not exists quiz_sessions_teacher_id_idx
  on public.quiz_sessions (teacher_id);
create index if not exists quiz_sessions_status_created_at_idx
  on public.quiz_sessions (status, created_at desc);
create index if not exists quiz_sessions_title_trgm_idx
  on public.quiz_sessions using gin (title gin_trgm_ops);
create index if not exists quiz_sessions_share_code_trgm_idx
  on public.quiz_sessions using gin (share_code gin_trgm_ops);

-- Quizzes ---------------------------------------------------------------------
drop view if exists public.search_quizzes;
create view public.search_quizzes
with (security_invoker = true)
as
select
  q.session_id::text as quiz_id,
  coalesce(t.id::text, '')::text as teacher_id,
  coalesce(t.username, t.email, q.teacher_username, '')::text as teacher_username,
  coalesce(q.title, 'Untitled quiz')::text as title,
  q.status::text as status,
  coalesce(question_count.total, 0)::integer as question_count,
  (q.created_at at time zone 'utc') as created_at
from public.quiz_sessions q
left join public.teachers t on t.user_id::text = q.teacher_id
left join lateral (
  select count(*)::integer as total
  from public.quiz_questions qq
  where qq.session_id = q.session_id
) question_count on true;

-- Participants ----------------------------------------------------------------
-- Built from everyone who joined (roster), started (attempts) or finished
-- (results) a quiz, so it does not depend on a students row existing.
-- Teacher/admin test runs are excluded the same way as the dashboards.
drop view if exists public.search_participants;
create view public.search_participants
with (security_invoker = true)
as
with pairs as (
  select s.session_id, s.username, s.created_at as joined_at
  from public.student_roster s
  union all
  select a.session_id, a.participant_username, a.created_at
  from public.quiz_attempts a
  where not public.is_staff_account(a.account_id)
    and not public.is_quiz_owner_name(a.session_id, a.participant_username)
  union all
  select r.session_id, r.participant_username, r.started_at
  from public.student_quiz_results r
),
participants as (
  select
    p.session_id,
    min(btrim(p.username)) as username,
    min(p.joined_at) as joined_at
  from pairs p
  where btrim(coalesce(p.username, '')) <> ''
  group by p.session_id, lower(btrim(p.username))
)
select
  (p.session_id || ':' || lower(p.username))::text as participant_id,
  p.session_id::text as session_id,
  coalesce(q.share_code, '')::text as session_code,
  p.session_id::text as quiz_id,
  coalesce(q.title, 'Untitled quiz')::text as quiz_title,
  p.username::text as username,
  case
    when latest_result.attempt_id is not null then 'completed'
    when latest_attempt.attempt_id is not null then 'in_progress'
    else 'not_started'
  end::text as status,
  latest_result.percentage as score,
  p.joined_at as joined_at,
  coalesce(student.email, '')::text as student_email,
  coalesce(t.id::text, '')::text as teacher_id,
  coalesce(t.username, t.email, q.teacher_username, '')::text as teacher_username
from participants p
join public.quiz_sessions q on q.session_id = p.session_id
left join public.teachers t on t.user_id::text = q.teacher_id
left join lateral (
  select r.attempt_id, r.percentage
  from public.student_quiz_results r
  where r.session_id = p.session_id
    and lower(r.participant_username) = lower(p.username)
  order by r.completed_at desc
  limit 1
) latest_result on true
left join lateral (
  select a.attempt_id
  from public.quiz_attempts a
  where a.session_id = p.session_id
    and lower(a.participant_username) = lower(p.username)
  order by a.created_at desc
  limit 1
) latest_attempt on true
left join lateral (
  select ap.email
  from public.account_profiles ap
  where ap.role = 'student'
    and (
      ap.username_key = lower(p.username)
      or lower(ap.username) = lower(p.username)
    )
  order by ap.created_at
  limit 1
) student on true;

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
    from public.quiz_sessions q
    where q.teacher_id = t.user_id::text
  ) as quiz_count,
  t.created_at
from public.teachers t;

-- Read-only grants (same as 202611030002_search_views_read_only) ---------------
revoke all on public.search_quizzes, public.search_participants, public.search_teachers
  from public, anon, authenticated;
grant select on public.search_quizzes, public.search_participants, public.search_teachers
  to authenticated;
