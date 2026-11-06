-- Run via: npx supabase migration new dashboard_quiz_sessions_and_realtime
-- then paste this file's contents into the generated file.
-- Safe to run more than once (create or replace + guarded publication adds).

-- 1) Owner lookup goes through quiz_sessions (the table the app writes to).
create or replace function public.is_quiz_owner_name(p_session_id text, p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select btrim(coalesce(p_username, '')) <> '' and exists (
    select 1
    from public.quiz_sessions s
    left join public.teachers t on t.user_id::text = s.teacher_id
    where s.session_id = p_session_id
      and lower(btrim(p_username)) in (
        lower(btrim(coalesce(s.teacher_username, ''))),
        lower(btrim(coalesce(t.username, ''))),
        lower(btrim(coalesce(t.email, '')))
      )
  );
$$;
revoke all on function public.is_quiz_owner_name(text, text) from public;
grant execute on function public.is_quiz_owner_name(text, text) to authenticated;

-- 2) Student results: staff accounts and the quiz owner's own test runs removed.
create or replace view public.student_quiz_results
with (security_invoker = true) as
select r.*
from public.quiz_results r
where not public.is_staff_account(r.account_id)
  and not public.is_quiz_owner_name(r.session_id, r.participant_username)
  and lower(r.participant_username) <> lower(coalesce(r.teacher_username, ''));

-- 3) Roster view (unchanged logic, now backed by the quiz_sessions lookup).
create or replace view public.student_roster
with (security_invoker = true) as
select s.*
from public.students s
where not public.is_quiz_owner_name(s.session_id, s.username);

grant select on public.student_quiz_results, public.student_roster to authenticated;

-- 4) Realtime: add each base table once (views cannot be published).
do $$
declare
  t text;
begin
  foreach t in array array[
    'quiz_sessions', 'quiz_results', 'students', 'account_profiles', 'teachers'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
