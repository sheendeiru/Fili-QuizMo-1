-- supabase/migrations/xxxx_exclude_staff_from_dashboards.sql
create index if not exists quiz_results_account_id_idx
  on public.quiz_results (account_id);


-- Runs with owner rights so RLS on teachers/admins/account_profiles can't hide staff.
create or replace function public.is_staff_account(p_account_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_account_id is not null and (
    exists (select 1 from public.teachers t where t.user_id = p_account_id)
    or exists (select 1 from public.admins a where a.user_id = p_account_id)
    or exists (
      select 1 from public.account_profiles p
      where p.user_id = p_account_id and p.role <> 'student'
    )
  );
$$;
revoke all on function public.is_staff_account(uuid) from public;
grant execute on function public.is_staff_account(uuid) to authenticated;


-- True when the participant name equals the quiz owner's own username.
create or replace function public.is_quiz_owner_name(p_session_id text, p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.quizzes q
    join public.teachers t on t.id = q.teacher_id
    where q.session_id = p_session_id
      and lower(t.username) = lower(btrim(p_username))
  );
$$;
revoke all on function public.is_quiz_owner_name(text, text) from public;
grant execute on function public.is_quiz_owner_name(text, text) to authenticated;


-- Scores: staff accounts and the owner testing under their own name are removed.
create or replace view public.student_quiz_results
with (security_invoker = true) as
select r.*
from public.quiz_results r
where not public.is_staff_account(r.account_id)
  and lower(r.participant_username) <> lower(coalesce(r.teacher_username, ''));


-- Roster: same idea for the students table (it has no account_id).
create or replace view public.student_roster
with (security_invoker = true) as
select s.*
from public.students s
where not public.is_quiz_owner_name(s.session_id, s.username);


grant select on public.student_quiz_results, public.student_roster to authenticated;
