-- Search views are read-only projections. They inherited Supabase's default
-- table grants (ALL for authenticated) when created, so revoke everything and
-- leave only SELECT.

revoke all on public.search_students from public, anon, authenticated;
revoke all on public.search_quizzes from public, anon, authenticated;
revoke all on public.search_participants from public, anon, authenticated;
revoke all on public.search_teachers from public, anon, authenticated;

grant select on public.search_students to authenticated;
grant select on public.search_quizzes to authenticated;
grant select on public.search_participants to authenticated;
grant select on public.search_teachers to authenticated;
