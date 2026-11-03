import { Suspense } from "react";
import StudentDashboardContent from "@/components/dashboard/student-dashboard-content";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { requireStudentAccess } from "@/lib/auth/require-dashboard-access";
import { createClient } from "@/lib/supabase/server";

const HISTORY_PAGE_SIZE = 5;

async function StudentDashboardData({
  userId,
  email,
  page,
}: {
  userId: string;
  email: string | null;
  page: number;
}) {
  const supabase = await createClient();

  const historyColumns =
    "attempt_id, session_id, quiz_title, attempt_number, correct_count, total_questions, answered_count, final_score, percentage, started_at, completed_at, duration_seconds";
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const [profileResult, summaryResult, historyResult] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("username, email, created_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("my_quiz_history")
      .select(historyColumns)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("my_quiz_history")
      .select(historyColumns, { count: "exact" })
      .order("completed_at", { ascending: false, nullsFirst: false })
      .range(from, from + HISTORY_PAGE_SIZE - 1),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }
  if (summaryResult.error) {
    throw summaryResult.error;
  }
  if (historyResult.error) {
    throw historyResult.error;
  }

  const historyTotal = historyResult.count ?? 0;
  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyTotal / HISTORY_PAGE_SIZE),
  );

  return (
    <StudentDashboardContent
      profile={{
        username: profileResult.data?.username ?? null,
        email: profileResult.data?.email ?? email,
        createdAt: profileResult.data?.created_at ?? null,
      }}
      history={historyResult.data ?? []}
      summaryHistory={summaryResult.data ?? []}
      historyTotal={historyTotal}
      historyPage={page}
      historyTotalPages={historyTotalPages}
    />
  );
}

type StudentDashboardPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return 1;
  }
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error("The page query must be a positive integer.");
  }

  const page = Number(raw);
  if (!Number.isSafeInteger(page) || page > 10_000) {
    throw new Error("The requested quiz history page is out of range.");
  }
  return page;
}

export default async function StudentDashboardPage({
  searchParams,
}: StudentDashboardPageProps) {
  const { user } = await requireStudentAccess();
  const params = await searchParams;
  const page = parsePage(params.page);
  return (
    <Suspense
      fallback={<DashboardSkeleton label="Loading student dashboard..." />}
    >
      <StudentDashboardData
        userId={user.id}
        email={user.email ?? null}
        page={page}
      />
    </Suspense>
  );
}
