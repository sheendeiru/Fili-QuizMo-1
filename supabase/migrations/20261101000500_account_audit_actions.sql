-- Extends account_credential_changes so the manage-students and
-- manage-teachers edge functions can log create / delete / reset_password.
-- Depends on: 20261101000000_account_credential_audit.sql

begin;

alter table public.account_credential_changes
  add column if not exists action text not null default 'update_credentials',
  add column if not exists target_email text;   -- snapshot, survives account deletion

alter table public.account_credential_changes
  drop constraint if exists account_credential_changes_action_check;
alter table public.account_credential_changes
  add constraint account_credential_changes_action_check
  check (action in ('update_credentials', 'create', 'delete', 'reset_password'));

-- The old rule required email or password to be flagged; only updates need that.
alter table public.account_credential_changes
  drop constraint if exists account_credential_changes_something_changed;
alter table public.account_credential_changes
  add constraint account_credential_changes_something_changed
  check (action <> 'update_credentials' or changed_email or changed_password);

-- Keep the id of deleted accounts in the history instead of nulling it.
alter table public.account_credential_changes
  drop constraint if exists account_credential_changes_target_user_id_fkey;

commit;
