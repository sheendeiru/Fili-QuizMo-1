-- Run via: npx supabase migration new search_quizzes_question_count
-- then paste this file's contents into the generated file.
--
-- Teachers/admins could not count quiz_questions through RLS (the table also
-- holds correct answers), so search_quizzes showed 0 questions. This function
-- returns ONLY a count, and only for the quiz's own teacher or an admin.

create or replace function public.quiz_question_count(p_session_id text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.quiz_sessions s
      where s.session_id = p_session_id
        and (
          s.teacher_id = auth.uid()::text
          or exists (
            select 1 from public.admins a where a.user_id = auth.uid()
          )
        )
    )
    then (
      select count(*)::integer
      from public.quiz_questions q
      where q.session_id = p_session_id
    )
    else 0
  end;
$$;

revoke all on function public.quiz_question_count(text) from public, anon;
grant execute on function public.quiz_question_count(text) to authenticated;

-- Same columns and types as before, so create or replace keeps the grants.
create or replace view public.search_quizzes
with (security_invoker = true)
as
select
  q.session_id::text as quiz_id,
  coalesce(t.id::text, '')::text as teacher_id,
  coalesce(t.username, t.email, q.teacher_username, '')::text as teacher_username,
  coalesce(q.title, 'Untitled quiz')::text as title,
  q.status::text as status,
  coalesce(public.quiz_question_count(q.session_id), 0)::integer as question_count,
  (q.created_at at time zone 'utc') as created_at
from public.quiz_sessions q
left join public.teachers t on t.user_id::text = q.teacher_id;
