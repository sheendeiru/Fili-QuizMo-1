-- Teachers must be able to read the student accounts they manage, but the
-- restrictive MFA policy on account_profiles hides every other row from staff
-- accounts (teachers have no MFA flow). Keep the MFA gate for admins while
-- allowing a teacher to read their own managed students.
--
-- The policy exists in the linked project but not in local migrations, so the
-- drop/create pair also brings fresh databases in line with production.
drop policy if exists staff_mfa_to_read_other_profiles on public.account_profiles;

create policy staff_mfa_to_read_other_profiles
on public.account_profiles
as restrictive
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select auth.jwt() ->> 'aal') = 'aal2'
  or not (select public.is_staff_user())
  or (
    public.teacher_manages_account(user_id)
    and not public.is_admin()
  )
);
