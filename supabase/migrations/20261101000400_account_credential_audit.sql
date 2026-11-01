-- Audit trail for credential changes made through the edge functions.
-- Written only by the service role (edge functions). Admins can read it.
-- Depends on: student_teacher_access.sql (is_admin()).

begin;

create table if not exists public.account_credential_changes (
  id               bigint generated always as identity primary key,
  actor_user_id    uuid references auth.users (id) on delete set null,
  target_user_id   uuid references auth.users (id) on delete set null,
  changed_email    boolean not null default false,
  changed_password boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint account_credential_changes_something_changed
    check (changed_email or changed_password)
);

create index if not exists account_credential_changes_target_idx
  on public.account_credential_changes (target_user_id, created_at desc);
create index if not exists account_credential_changes_actor_idx
  on public.account_credential_changes (actor_user_id, created_at desc);

alter table public.account_credential_changes enable row level security;

revoke all on public.account_credential_changes from anon, authenticated;
grant select on public.account_credential_changes to authenticated;

drop policy if exists credential_changes_admin_select on public.account_credential_changes;
create policy credential_changes_admin_select on public.account_credential_changes
  for select to authenticated
  using (public.is_admin());

commit;
