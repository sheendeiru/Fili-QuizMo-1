import { Suspense } from "react";
import StudentDashboardContent from "@/components/dashboard/student-dashboard-content";
import { requireStudentAccess } from "@/lib/auth/require-dashboard-access";
import { createClient } from "@/lib/supabase/server";
import { PixelLoader } from "@/components/ui/pixel-loader";

export default async function StudentDashboardPage() {
  const { user } = await requireStudentAccess();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("account_profiles")
    .select("username, email, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data: history, error: historyError } = await supabase
    .from("my_quiz_history")
    .select(
      "attempt_id, session_id, quiz_title, attempt_number, correct_count, total_questions, answered_count, final_score, percentage, started_at, completed_at, duration_seconds",
    )
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (historyError) {
    throw historyError;
  }

  return (
    <Suspense
      fallback={<PixelLoader label="Loading student dashboard..." variant="screen" />}
    >
      <StudentDashboardContent
        profile={{
          username: profile?.username ?? null,
          email: profile?.email ?? user.email ?? null,
          createdAt: profile?.created_at ?? null,
        }}
        history={history ?? []}
      />
    </Suspense>
  );
}
