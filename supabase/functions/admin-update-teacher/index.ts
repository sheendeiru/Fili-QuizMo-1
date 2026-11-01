// POST /functions/v1/admin-update-teacher
// Body: { "user_id": "<teacher auth uuid>", "email"?: string, "password"?: string }
//
// Allowed: admins only (public.admins), target must be a teacher.
import {
  applyCredentialUpdate,
  authenticate,
  HttpError,
  json,
  logChange,
  parseUpdateRequest,
  rowExists,
  serve,
  updatedFields,
} from "../_shared/accounts.ts";

serve(async (req) => {
  const { caller, userClient, adminClient } = await authenticate(req);
  const update = await parseUpdateRequest(req);

  // 1. Is the caller an admin? Checked by the database as the caller.
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr) {
    console.error("is_admin failed:", adminErr.message);
    throw new HttpError(500, "Authorization check failed");
  }
  if (isAdmin !== true) throw new HttpError(403, "Admins only");

  // 2. The target must be a teacher, and never an admin
  //    (admins change their own credentials with supabase.auth.updateUser).
  if (!(await rowExists(adminClient, "teachers", update.userId))) {
    throw new HttpError(404, "Teacher not found");
  }
  if (await rowExists(adminClient, "admins", update.userId)) {
    throw new HttpError(403, "Admin accounts cannot be changed here");
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
