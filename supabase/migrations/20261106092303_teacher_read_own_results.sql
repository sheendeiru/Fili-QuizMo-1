grant select on public.quiz_results, public.students to authenticated;

drop policy if exists "teachers read results of own sessions" on public.quiz_results;
create policy "teachers read results of own sessions"
on public.quiz_results for select to authenticated
using (exists (
  select 1 from public.quiz_sessions s
  where s.session_id = quiz_results.session_id
    and s.teacher_id = auth.uid()::text
));

drop policy if exists "teachers read roster of own sessions" on public.students;
create policy "teachers read roster of own sessions"
on public.students for select to authenticated
using (exists (
  select 1 from public.quiz_sessions s
  where s.session_id = students.session_id
    and s.teacher_id = auth.uid()::text
));

drop policy if exists "admins read all results" on public.quiz_results;
create policy "admins read all results"
on public.quiz_results for select to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admins read all students" on public.students;
create policy "admins read all students"
on public.students for select to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
