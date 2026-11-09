
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden } from "next/navigation";
import TeacherDashboardContent from "@/components/dashboard/teacher-dashboard-content";
import { DashboardRealtime } from "@/components/dashboard/dashboard-realtime";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { requireTeacherAccess } from "@/lib/auth/require-dashboard-access";
import { loadTeacherDashboardData } from "@/lib/dashboard/data";
import {
  loadTeacherAssignments,
  loadTeacherClasses,
} from "@/lib/classes/server";
import { createClient } from "@/lib/supabase/server";

async function TeacherDashboardData({ teacherId }: { teacherId: number }) {
  const supabase = await createClient();
  // Started first so the request to the quiz server overlaps the database reads.
  const classes = loadTeacherClasses();
  const assignments = loadTeacherAssignments();
  const data = await loadTeacherDashboardData(
    supabase,
    teacherId,
    classes,
    assignments,
  );
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
