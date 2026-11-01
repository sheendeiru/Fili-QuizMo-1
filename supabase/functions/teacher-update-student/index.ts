// POST /functions/v1/teacher-update-student
// Body: { "user_id": "<student auth uuid>", "email"?: string, "password"?: string }
//
// Allowed: an approved teacher for students they manage
//          (account_profiles.managed_by_teacher_id = their teachers.id).
//          Admins also pass the database check and may use this endpoint too.
import {
  applyCredentialUpdate,
  authenticate,
  HttpError,
  json,
  logChange,
  parseUpdateRequest,
  profileRole,
  rowExists,
  serve,
  updatedFields,
} from "../_shared/accounts.ts";

serve(async (req) => {
  const { caller, userClient, adminClient } = await authenticate(req);
  const update = await parseUpdateRequest(req);

  // 1. Does the caller manage this account? Checked by the database as the
  //    caller (approved teacher + managed_by_teacher_id match, or admin).
  const { data: allowed, error: authErr } = await userClient.rpc(
    "teacher_manages_account",
    { p_user_id: update.userId },
  );
  if (authErr) {
    console.error("teacher_manages_account failed:", authErr.message);
    throw new HttpError(500, "Authorization check failed");
  }
  if (allowed !== true) {
    throw new HttpError(403, "You do not manage this student account");
  }

  // 2. Defense in depth: the target must really be a student, and never a
  //    teacher or admin (the admin shortcut in the check above allows any id).
  if ((await profileRole(adminClient, update.userId)) !== "student") {
    throw new HttpError(403, "Only student accounts can be changed here");
  }
  if (
    (await rowExists(adminClient, "teachers", update.userId)) ||
    (await rowExists(adminClient, "admins", update.userId))
  ) {
    throw new HttpError(403, "Only student accounts can be changed here");
  }

  // 3. Apply the change with the service role.
  const result = await applyCredentialUpdate(adminClient, update);
  await logChange(adminClient, caller.id, update);

  return json(200, {
    ok: true,
    user_id: update.userId,
    email: result.email,
    updated: updatedFields(update),
  });
});
