import { Suspense } from "react";
import { forbidden } from "next/navigation";
import TeacherDashboardContent from "@/components/dashboard/teacher-dashboard-content";
import { requireTeacherAccess } from "@/lib/auth/require-dashboard-access";
import { loadTeacherDashboardData } from "@/lib/dashboard/data";
import { createClient } from "@/lib/supabase/server";
import { PixelLoader } from "@/components/ui/pixel-loader";

export default async function TeacherDashboardPage() {
  const { access } = await requireTeacherAccess();

  if (access.teacherId === null) {
    forbidden();
  }

  const supabase = await createClient();
  const data = await loadTeacherDashboardData(supabase, access.teacherId);

  return (
    <Suspense
      fallback={<PixelLoader label="Loading teacher dashboard..." variant="screen" />}
    >
      <TeacherDashboardContent data={data} />
    </Suspense>
  );
}
