-- Teacher accounts may edit their own profile, but only an administrator may
-- change the approval status. Without this guard, teachers_update_own lets a
-- teacher approve their own account directly through PostgREST.
--
-- NOT APPLIED YET: review and apply with the search-view migration.

create or replace function public.guard_teacher_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not public.is_admin()
     and coalesce(current_setting('request.jwt.claim.role', true), '')
       <> 'service_role'
  then
    raise exception 'Only administrators can change teacher account status.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists teachers_guard_status_change on public.teachers;
create trigger teachers_guard_status_change
before update of status on public.teachers
for each row execute function public.guard_teacher_status_change();
