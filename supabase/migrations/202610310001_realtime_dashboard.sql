-- Realtime support for the admin and teacher dashboards.
--
-- This migration is intentionally limited to publication membership and
-- replica identity. It does not change RLS policies, grants, table columns,
-- or the search indexes. Apply it only after reviewing it against the
-- deployed Supabase project.
--
-- The dashboard subscribes to:
--   quizzes       (admin: all rows; teacher: teacher_id = numeric teachers.id)
--   quiz_results  (admin: all rows; teacher: teacher_id = auth UUID)
--   teachers      (admin only, for the teacher-account search view)
--
-- Realtime postgres_changes respects RLS, so the existing SELECT policies
-- must continue to allow each role to see only its permitted rows.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quizzes'
  ) then
    execute 'alter publication supabase_realtime add table public.quizzes';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_results'
  ) then
    execute 'alter publication supabase_realtime add table public.quiz_results';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'teachers'
  ) then
    execute 'alter publication supabase_realtime add table public.teachers';
  end if;
end
$$;

-- Filtered subscriptions need the old row to evaluate the teacher_id filter
-- on UPDATE and DELETE events. Without FULL identity, those events may not
-- reach the teacher's channel. Realtime also expects a primary key on the
-- published table; confirm quiz_results has one (attempt_id) before applying.
alter table public.quizzes replica identity full;
alter table public.quiz_results replica identity full;
