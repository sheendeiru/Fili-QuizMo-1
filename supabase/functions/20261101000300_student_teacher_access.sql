-- =====================================================================
-- Student / teacher access update
-- Target: Supabase / PostgreSQL 15+
-- Depends on: normalized_core_tables.sql, students_table.sql (already applied)
--
-- WHO CAN DO WHAT
--   Student (authenticated, account_profiles.role = 'student')
--     - view own scores, own attempts (quizzes taken), own start/finish times
--     - view / edit own username
--   Teacher (approved row in public.teachers)
--     - create / read / update / delete own quizzes and their questions
--     - read every student's attempts, answers, scores and time records
--       for quizzes they own
--     - read student profiles (username, email) for students they manage or
--       who took their quizzes; edit usernames of students they manage
--     - create / delete student accounts, change student email / password:
--       NOT possible from SQL or RLS. Passwords live hashed in auth.users and
--       must be changed through the Supabase Auth Admin API (service role,
--       e.g. an Edge Function). public.teacher_manages_account() below is the
--       authorization check for that function.
--   Admin
--     - everything a teacher can do on any quiz, plus approve teachers
--
-- Run order: 1) table changes  2) helpers  3) triggers  4) RLS  5) views
--            6) backfill
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Table changes
-- ---------------------------------------------------------------------

-- 1.1 quizzes: keep in step with quiz_sessions ('draft' status, revision)
alter table public.quizzes drop constraint if exists quizzes_status_check;
alter table public.quizzes
  add constraint quizzes_status_check
  check (status in ('processing', 'draft', 'ready', 'failed'));

alter table public.quizzes
  add column if not exists revision integer not null default 0;

-- 1.2 account_profiles: email copy + which teacher manages the student
alter table public.account_profiles
  add column if not exists email text,
  add column if not exists managed_by_teacher_id bigint
      references public.teachers (id) on delete set null;

-- Deleting an auth user (Auth Admin API) must remove the profile, otherwise
-- deleteUser() fails on this foreign key.
alter table public.account_profiles drop constraint if exists account_profiles_user_id_fkey;
alter table public.account_profiles
  add constraint account_profiles_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- 1.3 Link attempts / results to the student's auth account.
-- NOT VALID: new rows are checked, legacy rows are not.
-- SET NULL: deleting a student account keeps the teacher's score records.
alter table public.quiz_attempts drop constraint if exists quiz_attempts_account_id_fkey;
alter table public.quiz_attempts
  add constraint quiz_attempts_account_id_fkey
  foreign key (account_id) references auth.users (id) on delete set null not valid;

alter table public.quiz_results drop constraint if exists quiz_results_account_id_fkey;
alter table public.quiz_results
  add constraint quiz_results_account_id_fkey
  foreign key (account_id) references auth.users (id) on delete set null not valid;

-- Time records must be sane (new rows only).
alter table public.quiz_results drop constraint if exists quiz_results_time_order_check;
alter table public.quiz_results
  add constraint quiz_results_time_order_check
  check (completed_at >= started_at) not valid;

-- 1.4 Indexes used by the policies and dashboards
create index if not exists quiz_attempts_account_id_idx  on public.quiz_attempts (account_id);
create index if not exists quiz_attempts_session_id_idx  on public.quiz_attempts (session_id);
create index if not exists quiz_results_account_id_idx   on public.quiz_results  (account_id);
create index if not exists quiz_results_session_id_idx   on public.quiz_results  (session_id);
create index if not exists quiz_answers_attempt_id_idx   on public.quiz_answers  (attempt_id);
create index if not exists quiz_answers_session_id_idx   on public.quiz_answers  (session_id);
create index if not exists quiz_questions_session_id_idx on public.quiz_questions (session_id);
create index if not exists account_profiles_managed_by_idx
  on public.account_profiles (managed_by_teacher_id);

-- ---------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER avoids recursive RLS lookups)
--    is_admin() and current_teacher_id() already exist.
-- ---------------------------------------------------------------------

-- Does the calling (approved) teacher own this quiz?
create or replace function public.owns_quiz(p_session_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quizzes q
    where q.session_id = p_session_id
      and q.teacher_id = public.current_teacher_id()
  );
$$;

-- May the caller change this student's account? (own managed students only)
-- Call this from the Edge Function BEFORE using the service role.
create or replace function public.teacher_manages_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or exists (
        select 1
        from public.account_profiles p
        where p.user_id = p_user_id
          and p.role = 'student'
          and p.managed_by_teacher_id = public.current_teacher_id()
      );
$$;

-- May the caller read this account's profile? (managed students, or students
-- who attempted one of the caller's quizzes)
create or replace function public.teacher_can_view_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.teacher_manages_account(p_user_id)
      or exists (
        select 1
        from public.quiz_attempts a
        join public.quizzes q on q.session_id = a.session_id
        where a.account_id = p_user_id
          and q.teacher_id = public.current_teacher_id()
      )
      or exists (
        select 1
        from public.quiz_results r
        join public.quizzes q on q.session_id = r.session_id
        where r.account_id = p_user_id
          and q.teacher_id = public.current_teacher_id()
      );
$$;

revoke all on function public.owns_quiz(text)                from public, anon;
revoke all on function public.teacher_manages_account(uuid)  from public, anon;
revoke all on function public.teacher_can_view_account(uuid) from public, anon;
grant execute on function public.owns_quiz(text)                 to authenticated;
grant execute on function public.teacher_manages_account(uuid)   to authenticated;
grant execute on function public.teacher_can_view_account(uuid)  to authenticated;

-- ---------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------

-- 3.1 account_profiles: keep username_key = lower(username) on every change
--     (the old column default only applied on insert) and copy the email
--     from auth.users when the profile is created.
create or replace function public.account_profiles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.username_key := lower(new.username);

  if tg_op = 'INSERT' then
    select u.email into new.email from auth.users u where u.id = new.user_id;
  elsif new.user_id is distinct from old.user_id then
    select u.email into new.email from auth.users u where u.id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists account_profiles_before_write on public.account_profiles;
create trigger account_profiles_before_write
  before insert or update of username, user_id on public.account_profiles
  for each row execute function public.account_profiles_before_write();

-- 3.2 Keep email copies in sync when auth.users.email changes
--     (self-service change, or Auth Admin API call by a teacher).
create or replace function public.sync_account_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_profiles
     set email = new.email
   where user_id = new.id and email is distinct from new.email;

  update public.teachers
     set email = new.email
   where user_id = new.id and email is distinct from new.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_account_emails();

-- 3.3 teachers: a teacher may edit their own row, but only the username.
--     Status, owner, school and email can be changed by admins or the backend
--     (no JWT user) only. Prevents self-approval.
create or replace function public.guard_teacher_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if new.status    is distinct from old.status
    or new.user_id   is distinct from old.user_id
    or new.school_id is distinct from old.school_id
    or new.email     is distinct from old.email then
      raise exception 'Only an admin can change status, user_id, school_id or email';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists teachers_guard_update on public.teachers;
create trigger teachers_guard_update
  before update on public.teachers
  for each row execute function public.guard_teacher_update();

-- ---------------------------------------------------------------------
-- 4. Row Level Security
--    WARNING: enabling RLS on these tables blocks any client that reads or
--    writes them with the anon key. The service role bypasses RLS.
-- ---------------------------------------------------------------------

alter table public.account_profiles enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.quiz_results     enable row level security;
alter table public.quiz_answers     enable row level security;
alter table public.quiz_questions   enable row level security;
alter table public.user_answers     enable row level security;

-- Explicit grants (RLS still decides which rows)
grant select                          on public.quiz_attempts, public.quiz_results,
                                         public.quiz_answers, public.user_answers to authenticated;
grant select, insert, update, delete  on public.quiz_questions to authenticated;
grant select, insert                  on public.account_profiles to authenticated;
revoke update on public.account_profiles from anon, authenticated;
grant update (username, username_key) on public.account_profiles to authenticated;

-- 4.1 account_profiles ------------------------------------------------
drop policy if exists profiles_select_own        on public.account_profiles;
drop policy if exists profiles_select_teacher    on public.account_profiles;
drop policy if exists profiles_insert_own        on public.account_profiles;
drop policy if exists profiles_update_own        on public.account_profiles;
drop policy if exists profiles_update_managed    on public.account_profiles;
drop policy if exists profiles_admin_all         on public.account_profiles;

create policy profiles_select_own on public.account_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_select_teacher on public.account_profiles
  for select to authenticated
  using (public.teacher_can_view_account(user_id));

create policy profiles_insert_own on public.account_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()) and managed_by_teacher_id is null);

create policy profiles_update_own on public.account_profiles
  for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy profiles_update_managed on public.account_profiles
  for update to authenticated
  using      (public.teacher_manages_account(user_id))
  with check (public.teacher_manages_account(user_id));

create policy profiles_admin_all on public.account_profiles
  for all to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

-- 4.2 quiz_attempts: students see their own, teachers see their quizzes' ---
drop policy if exists attempts_student_select on public.quiz_attempts;
drop policy if exists attempts_teacher_select on public.quiz_attempts;
drop policy if exists attempts_admin_select   on public.quiz_attempts;

create policy attempts_student_select on public.quiz_attempts
  for select to authenticated
  using (account_id = (select auth.uid()));

create policy attempts_teacher_select on public.quiz_attempts
  for select to authenticated
  using (public.owns_quiz(session_id));

create policy attempts_admin_select on public.quiz_attempts
  for select to authenticated
  using (public.is_admin());

-- 4.3 quiz_results (scores + start/finish times) ---------------------------
drop policy if exists results_student_select on public.quiz_results;
drop policy if exists results_teacher_select on public.quiz_results;
drop policy if exists results_admin_select   on public.quiz_results;

create policy results_student_select on public.quiz_results
  for select to authenticated
  using (account_id = (select auth.uid()));

create policy results_teacher_select on public.quiz_results
  for select to authenticated
  using (public.owns_quiz(session_id));

create policy results_admin_select on public.quiz_results
  for select to authenticated
  using (public.is_admin());

-- 4.4 quiz_answers / user_answers: teachers and admins only ---------------
-- (students do not read answers directly: that could expose correct answers)
drop policy if exists answers_teacher_select      on public.quiz_answers;
drop policy if exists answers_admin_select        on public.quiz_answers;
drop policy if exists user_answers_teacher_select on public.user_answers;
drop policy if exists user_answers_admin_select   on public.user_answers;

create policy answers_teacher_select on public.quiz_answers
  for select to authenticated using (public.owns_quiz(session_id));
create policy answers_admin_select on public.quiz_answers
  for select to authenticated using (public.is_admin());

create policy user_answers_teacher_select on public.user_answers
  for select to authenticated using (public.owns_quiz(session_id));
create policy user_answers_admin_select on public.user_answers
  for select to authenticated using (public.is_admin());

-- 4.5 quiz_questions: full CRUD for the quiz owner -------------------------
-- (students never read this table: it contains correct_answer)
drop policy if exists questions_owner_all on public.quiz_questions;
drop policy if exists questions_admin_all on public.quiz_questions;

create policy questions_owner_all on public.quiz_questions
  for all to authenticated
  using      (public.owns_quiz(session_id))
  with check (public.owns_quiz(session_id));

create policy questions_admin_all on public.quiz_questions
  for all to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

-- 4.6 teachers: allow a teacher to edit their own row (guard trigger limits
--     this to the username column in practice)
drop policy if exists teachers_update_own on public.teachers;
create policy teachers_update_own on public.teachers
  for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- quizzes already has quizzes_owner_all (teacher CRUD on own quizzes) and
-- quizzes_admin_all from normalized_core_tables.sql.

-- ---------------------------------------------------------------------
-- 5. Views (security_invoker: RLS of the caller applies)
-- ---------------------------------------------------------------------

-- Student: my scores, quizzes taken and time records
create or replace view public.my_quiz_history
with (security_invoker = true) as
select r.attempt_id,
       r.session_id,
       r.title                as quiz_title,
       r.attempt_number,
       r.correct_count,
       r.total_questions,
       r.answered_count,
       r.final_score,
       r.percentage,
       r.started_at,
       r.completed_at,
       extract(epoch from (r.completed_at - r.started_at))::integer as duration_seconds
from public.quiz_results r
where r.account_id = (select auth.uid());

-- Teacher: every student's scores on the teacher's quizzes
create or replace view public.teacher_student_scores
with (security_invoker = true) as
select r.attempt_id,
       r.session_id,
       r.title                                   as quiz_title,
       r.account_id                              as student_user_id,
       coalesce(p.username, r.participant_username) as student_username,
       p.email                                   as student_email,
       r.attempt_number,
       r.correct_count,
       r.total_questions,
       r.answered_count,
       r.final_score,
       r.percentage,
       r.started_at,
       r.completed_at,
       extract(epoch from (r.completed_at - r.started_at))::integer as duration_seconds
from public.quiz_results r
left join public.account_profiles p on p.user_id = r.account_id;

revoke all on public.my_quiz_history, public.teacher_student_scores from anon, authenticated;
grant select on public.my_quiz_history, public.teacher_student_scores to authenticated;

-- ---------------------------------------------------------------------
-- 6. Backfill
-- ---------------------------------------------------------------------

-- 6.1 Email copies
update public.account_profiles p
   set email = u.email
  from auth.users u
 where u.id = p.user_id and p.email is distinct from u.email;

-- 6.2 Quizzes created in quiz_sessions after the first migration
--     (teacher_id text in quiz_sessions is assumed to be the auth user UUID)
insert into public.quizzes (
  session_id, teacher_id, title, game_mode, is_time_attack, time_attack_seconds,
  status, error_message, share_code, requested_question_count, max_attempts,
  revision, created_at
)
select qs.session_id,
       t.id,
       qs.title,
       coalesce(qs.game_mode, 'multiple_choice'),
       coalesce(qs.is_time_attack, false),
       qs.time_attack_seconds,
       qs.status,
       qs.error_message,
       qs.share_code,
       qs.requested_question_count,
       qs.max_attempts,
       qs.revision,
       coalesce(qs.created_at at time zone 'UTC', now())
from public.quiz_sessions qs
left join public.teachers t on t.user_id::text = qs.teacher_id
on conflict (session_id) do nothing;

commit;

-- ---------------------------------------------------------------------
-- Quick test (run in the SQL editor, replace the UUID with a real student)
-- ---------------------------------------------------------------------
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
--   select * from public.my_quiz_history;       -- only that student's rows
--   select * from public.quiz_questions;        -- 0 rows for a student
-- rollback;
