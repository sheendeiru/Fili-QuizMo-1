// POST /functions/v1/manage-teachers       (admins only)
//
//   { "action": "create", "email": "...", "username": "...",
//     "password"?: "...", "status"?: "approved" | "pending" }
//       Creates a teacher (default status: approved). If no password is
//       given, a temporary one is generated and returned ONCE.
//
//   { "action": "reset_password", "user_id": "<teacher uuid>" }
//       Sets a new random password and returns it ONCE.
//
//   { "action": "delete", "user_id": "<teacher uuid>",
//     "reassign_to_user_id"?: "<other teacher uuid>", "force"?: boolean }
//       Deletes the teacher's account. If the teacher still owns quizzes or
//       manages students the request is refused (409) unless you either
//       reassign them to another approved teacher or pass force: true
//       (quizzes and students are then left without an owner).
import {
  authenticate,
  type Context,
  HttpError,
  json,
  rowExists,
  serve,
} from "../_shared/accounts.ts";
import {
  type Body,
  countRows,
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
 
serve(async (req) => {
  const ctx = await authenticate(req);
  await requireAdmin(ctx.userClient);
  const body = await readBody(req);
 
  switch (body.action) {
    case "create":
      return await createTeacher(ctx, body);
    case "reset_password":
      return await resetTeacherPassword(ctx, body);
    case "delete":
      return await deleteTeacher(ctx, body);
    default:
      throw new HttpError(400, "action must be create, reset_password or delete");
  }
});
 
/** Target must be a teacher, and never an admin. Returns the teachers.id. */
async function assertTeacher(
  { adminClient }: Context,
  userId: string,
): Promise<number> {
  const { data, error } = await adminClient
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("teachers lookup failed:", error.message);
    throw new HttpError(500, "Lookup failed");
  }
  if (!data) throw new HttpError(404, "Teacher not found");
  if (await rowExists(adminClient, "admins", userId)) {
    throw new HttpError(403, "Admin accounts cannot be managed here");
  }
  return data.id as number;
}
 
async function createTeacher(ctx: Context, body: Body): Promise<Response> {
  const { caller, adminClient } = ctx;
 
  const email = requireEmail(body);
  const username = requireUsername(body);
  const supplied = optionalPassword(body);
  const password = supplied ?? generatePassword();
 
  const status = body.status ?? "approved";
  if (status !== "approved" && status !== "pending") {
    throw new HttpError(400, "status must be approved or pending");
  }
 
  if (await usernameTaken(adminClient, username)) {
    throw new HttpError(409, "That username is already taken");
  }
 
  const userId = await createAuthUser(adminClient, email, password);
 
  const { error: teacherErr } = await adminClient
    .from("teachers")
    .upsert({ user_id: userId, email, username, status }, { onConflict: "user_id" });
  const { error: profileErr } = teacherErr
    ? { error: null }
    : await adminClient
      .from("account_profiles")
      .upsert({ user_id: userId, role: "teacher", username }, { onConflict: "user_id" });
 
  const failure = teacherErr ?? profileErr;
  if (failure) {
    await deleteAuthUserQuietly(adminClient, userId); // cascades the rest
    if (failure.code === "23505") {
      throw new HttpError(409, "That username is already taken");
    }
    console.error("teacher insert failed:", failure.message);
    throw new HttpError(500, "Could not create the teacher");
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
    status,
    ...(supplied === null ? { temporary_password: password } : {}),
  });
}
 
async function resetTeacherPassword(ctx: Context, body: Body): Promise<Response> {
  const { caller, adminClient } = ctx;
  const userId = requireUuid(body, "user_id");
  await assertTeacher(ctx, userId);
 
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
 
async function deleteTeacher(ctx: Context, body: Body): Promise<Response> {
  const { caller, adminClient } = ctx;
  const userId = requireUuid(body, "user_id");
  if (userId === caller.id) {
    throw new HttpError(403, "You cannot delete your own account");
  }
  const teacherId = await assertTeacher(ctx, userId);
 
  const force = body.force === true;
  const reassignUserId = body.reassign_to_user_id === undefined
    ? null
    : requireUuid(body, "reassign_to_user_id");
 
  const quizCount = await countRows(adminClient, "quizzes", "teacher_id", teacherId);
  const studentCount = await countRows(
    adminClient,
    "account_profiles",
    "managed_by_teacher_id",
    teacherId,
  );
 
  const hasDependents = quizCount > 0 || studentCount > 0;
  let reassigned = false;
 
  if (hasDependents && reassignUserId === null && !force) {
    return json(409, {
      error:
        "Teacher still owns quizzes or manages students. Pass reassign_to_user_id to move them, or force: true to leave them without an owner.",
      quizzes: quizCount,
      students: studentCount,
    });
  }
 
  if (hasDependents && reassignUserId !== null) {
    if (reassignUserId === userId) {
      throw new HttpError(400, "Cannot reassign to the teacher being deleted");
    }
    const { data: heir, error: heirErr } = await adminClient
      .from("teachers")
      .select("id, status")
      .eq("user_id", reassignUserId)
      .maybeSingle();
    if (heirErr) {
      console.error("heir lookup failed:", heirErr.message);
      throw new HttpError(500, "Lookup failed");
    }
    if (!heir || heir.status !== "approved") {
      throw new HttpError(400, "reassign_to_user_id must be an approved teacher");
    }
 
    // Both updates are idempotent, so a failed request can simply be retried.
    const moveQuizzes = await adminClient
      .from("quizzes")
      .update({ teacher_id: heir.id })
      .eq("teacher_id", teacherId);
    const moveStudents = await adminClient
      .from("account_profiles")
      .update({ managed_by_teacher_id: heir.id })
      .eq("managed_by_teacher_id", teacherId);
    if (moveQuizzes.error || moveStudents.error) {
      console.error("reassign failed:", moveQuizzes.error?.message, moveStudents.error?.message);
      throw new HttpError(500, "Could not reassign quizzes and students; nothing was deleted");
    }
    reassigned = true;
  }
 
  const email = await emailOf(adminClient, userId); // keep for the audit log
  await deleteAuthUser(adminClient, userId); // cascades to teachers + profile
 
  await logAction(adminClient, {
    actorId: caller.id,
    targetId: userId,
    targetEmail: email,
    action: "delete",
  });
 
  return json(200, {
    ok: true,
    user_id: userId,
    deleted: true,
    reassigned,
  });
}
 
