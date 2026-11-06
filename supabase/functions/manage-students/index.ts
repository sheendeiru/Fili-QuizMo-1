// POST /functions/v1/manage-students       (approved teachers; admins for delete/reset)
//
//   { "action": "create", "email": "...", "username": "...", "password"?: "..." }
//       Creates a student account managed by the calling teacher. If no
//       password is given, a temporary one is generated and returned ONCE.
//
//   { "action": "reset_password", "user_id": "<student uuid>" }
//       Sets a new random password and returns it ONCE.
//
//   { "action": "delete", "user_id": "<student uuid>" }
//       Permanently deletes the student's account. Their quiz results stay
//       (quiz_results.account_id becomes NULL, participant_username is kept).
import {
  authenticate,
  type Context,
  HttpError,
  json,
  profileRole,
  rowExists,
  serve,
} from "../_shared/accounts.ts";
import {
  type Body,
  createAuthUser,
  deleteAuthUser,
  deleteAuthUserQuietly,
  emailOf,
  generatePassword,
  logAction,
  optionalPassword,
  readBody,
  requireAdmin,
  requireEmail,
  requireUsername,
  requireUuid,
  resetPassword,
  usernameTaken,
} from "../_shared/lifecycle.ts";

async function isAdmin(ctx: Context): Promise<boolean> {
  const { data, error } = await ctx.userClient.rpc("is_admin");
  if (error) {
    console.error("is_admin failed:", error.message);
    throw new HttpError(500, "Authorization check failed");
  }
  if (data === true) {
    await requireAdmin(ctx);
    return true;
  }
  return false;
}

serve(async (req) => {
  const ctx = await authenticate(req);
  const body = await readBody(req);

  switch (body.action) {
    case "create":
      return await createStudent(ctx, body);
    case "reset_password":
      return await resetStudentPassword(ctx, body);
    case "delete":
      return await deleteStudent(ctx, body);
    default:
      throw new HttpError(400, "action must be create, reset_password or delete");
  }
});

/** The caller must manage this student, and the target must really be one. */
async function assertManagedStudent(
  ctx: Context,
  userId: string,
): Promise<void> {
  const { userClient, adminClient } = ctx;
  await isAdmin(ctx);
  const { data: allowed, error } = await userClient.rpc(
    "teacher_manages_account",
    { p_user_id: userId },
  );
  if (error) {
    console.error("teacher_manages_account failed:", error.message);
    throw new HttpError(500, "Authorization check failed");
  }
  if (allowed !== true) {
    throw new HttpError(403, "You do not manage this student account");
  }

  // Defense in depth: the admin shortcut in the check above accepts any id.
  if (
    (await profileRole(adminClient, userId)) !== "student" ||
    (await rowExists(adminClient, "teachers", userId)) ||
    (await rowExists(adminClient, "admins", userId))
  ) {
    throw new HttpError(403, "Only student accounts can be managed here");
  }
}

async function createStudent(ctx: Context, body: Body): Promise<Response> {
  const { caller, userClient, adminClient } = ctx;

  let teacherId: number | null;
  if (await isAdmin(ctx)) {
    const rawTeacherId = body.teacher_id;
    if (rawTeacherId === undefined || rawTeacherId === null) {
      teacherId = null;
    } else {
      if (
        typeof rawTeacherId !== "number" ||
        !Number.isSafeInteger(rawTeacherId) ||
        rawTeacherId < 1
      ) {
        throw new HttpError(400, "teacher_id must be a positive teacher id");
      }

      const { data: teacher, error } = await adminClient
        .from("teachers")
        .select("id, status")
        .eq("id", rawTeacherId)
        .maybeSingle();
      if (error) {
        console.error("Managing teacher lookup failed:", error.message);
        throw new HttpError(500, "Could not verify the managing teacher");
      }
      if (!teacher || teacher.status !== "approved") {
        throw new HttpError(400, "teacher_id must be an approved teacher");
      }
      teacherId = teacher.id;
    }
  } else {
    const { data, error } = await userClient.rpc("current_teacher_id");
    if (error) {
      console.error("current_teacher_id failed:", error.message);
      throw new HttpError(500, "Authorization check failed");
    }
    if (data === null || data === undefined) {
      throw new HttpError(403, "Only approved teachers can create students");
    }
    teacherId = data;
  }

  const email = requireEmail(body);
  const username = requireUsername(body);
  const supplied = optionalPassword(body);
  const password = supplied ?? generatePassword();

  if (await usernameTaken(adminClient, username)) {
    throw new HttpError(409, "That username is already taken");
  }

  const userId = await createAuthUser(adminClient, email, password);

  // upsert: also works if a signup trigger already created a profile row
  const { error: profileErr } = await adminClient
    .from("account_profiles")
    .upsert(
      {
        user_id: userId,
        role: "student",
        username,
        managed_by_teacher_id: teacherId,
      },
      { onConflict: "user_id" },
    );
  if (profileErr) {
    await deleteAuthUserQuietly(adminClient, userId); // no orphan login
    if (profileErr.code === "23505") {
      throw new HttpError(409, "That username is already taken");
    }
    console.error("profile insert failed:", profileErr.message);
    throw new HttpError(500, "Could not create the student");
  }

  await logAction(adminClient, {
    actorId: caller.id,
    targetId: userId,
    targetEmail: email,
    action: "create",
    changedEmail: true,
    changedPassword: true,
  });

  return json(201, {
    ok: true,
    user_id: userId,
    email,
    username,
    // returned once, only when the teacher did not choose the password
    ...(supplied === null ? { temporary_password: password } : {}),
  });
}

async function resetStudentPassword(ctx: Context, body: Body): Promise<Response> {
  const { caller, adminClient } = ctx;
  const userId = requireUuid(body, "user_id");
  await assertManagedStudent(ctx, userId);

  const email = await emailOf(adminClient, userId);
  const temporaryPassword = await resetPassword(adminClient, userId);

  await logAction(adminClient, {
    actorId: caller.id,
    targetId: userId,
    targetEmail: email,
    action: "reset_password",
    changedPassword: true,
  });

  return json(200, {
    ok: true,
    user_id: userId,
    temporary_password: temporaryPassword,
  });
}

async function deleteStudent(ctx: Context, body: Body): Promise<Response> {
  const { caller, adminClient } = ctx;
  const userId = requireUuid(body, "user_id");
  if (userId === caller.id) {
    throw new HttpError(403, "You cannot delete your own account");
  }
  await assertManagedStudent(ctx, userId);

  const email = await emailOf(adminClient, userId); // keep for the audit log
  await deleteAuthUser(adminClient, userId); // cascades to account_profiles

  await logAction(adminClient, {
    actorId: caller.id,
    targetId: userId,
    targetEmail: email,
    action: "delete",
  });

  return json(200, { ok: true, user_id: userId, deleted: true });
}
