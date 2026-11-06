
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden } from "next/navigation";
import TeacherDashboardContent from "@/components/dashboard/teacher-dashboard-content";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { requireTeacherAccess } from "@/lib/auth/require-dashboard-access";
import { loadTeacherDashboardData } from "@/lib/dashboard/data";
import { createClient } from "@/lib/supabase/server";

async function TeacherDashboardData({ teacherId }: { teacherId: number }) {
  const supabase = await createClient();
  const data = await loadTeacherDashboardData(supabase, teacherId);
  return <TeacherDashboardContent data={data} />;
}

export const instant = false;
export default async function TeacherDashboardPage() {
  await connection();
  const { access } = await requireTeacherAccess();
  if (access.teacherId === null) {
    forbidden();
  }

  return (
    <>
      <DashboardRealtime role="teacher" teacherId={access.teacherId} />
      <Suspense
        fallback={<DashboardSkeleton variant="teacher" label="Loading teacher dashboard..." />}
      >
        <TeacherDashboardData teacherId={access.teacherId} />
      </Suspense>
    </>
  );
}
