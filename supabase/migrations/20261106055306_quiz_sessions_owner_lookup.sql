-- Owner lookup now goes through quiz_sessions (the table the app writes to).
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

-- Same columns as before (r.*), so create or replace is allowed.
create or replace view public.student_quiz_results
with (security_invoker = true) as
select r.*
from public.quiz_results r
where not public.is_staff_account(r.account_id)
  and not public.is_quiz_owner_name(r.session_id, r.participant_username)
  and lower(r.participant_username) <> lower(coalesce(r.teacher_username, ''));
